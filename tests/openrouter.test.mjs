import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { aiProvider, effectiveModels, openRouterKey } from "../lib/ai/provider-config.ts";
import { textClient } from "../lib/ai/text-client.ts";
import { generateImages } from "../lib/ai/images.ts";
import { parseOpenRouterImages } from "../lib/ai/openrouter-images.ts";

const models = { editorial: "claude-opus-5", fast: "claude-sonnet-5", light: "claude-haiku-4-5", image: "gemini-3.1-flash-image" };
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6AAAAABJRU5ErkJggg==";

function messageResponse(request, text, { stop = "end_turn", input = 10, output = 4 } = {}) {
  const message = { id: "msg_test", type: "message", role: "assistant", content: [{ type: "text", text }], model: request.model, stop_reason: stop, stop_sequence: null, usage: { input_tokens: input, output_tokens: output } };
  if (!request.stream) return Response.json(message);
  const events = [
    { type: "message_start", message: { ...message, content: [], stop_reason: null, usage: { input_tokens: input, output_tokens: 0 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: output } },
    { type: "message_stop" },
  ];
  return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
}
async function editorialModule() {
  const output = await build({ entryPoints: ["lib/ai/editorial.ts"], bundle: true, platform: "node", format: "cjs", packages: "external", write: false });
  const compiled = { exports: {} };
  new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
  return compiled.exports;
}

async function isolated(fn) {
  const keys = ["AI_PROVIDER", "OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"];
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "test-openrouter-key", ANTHROPIC_API_KEY: "test-direct-key", GEMINI_API_KEY: "test-google-key", OPENAI_API_KEY: "test-openai-key" });
  try { await fn(); } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
  }
}

test("provider selection preserves direct mode, rejects masked keys and maps both model namespaces", () => {
  assert.equal(aiProvider({}), "anthropic");
  assert.equal(aiProvider({ OPENROUTER_API_KEY: "test-key" }), "anthropic");
  assert.equal(aiProvider({ AI_PROVIDER: "anthropic", OPENROUTER_API_KEY: "test-key" }), "anthropic");
  assert.equal(openRouterKey({ OPENROUTER_API_KEY: "sk-or-v1-*****" }), "");
  assert.throws(() => aiProvider({ AI_PROVIDER: "invalid" }));
  const routed = effectiveModels(models, { AI_PROVIDER: "openrouter" });
  assert.equal(routed.light, "anthropic/claude-haiku-4.5");
  assert.equal(routed.image, "google/gemini-3.1-flash-image");
  assert.deepEqual(effectiveModels(routed, { AI_PROVIDER: "anthropic" }), models);
  assert.equal(effectiveModels(models, { AI_PROVIDER: "openrouter", OPENROUTER_MODEL_IMAGE: "openai/gpt-image-2" }).image, "openai/gpt-image-2");
});

test("Messages SDK uses the OpenRouter endpoint and only its bearer credential", () => isolated(async () => {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), "https://openrouter.ai/api/v1/messages");
    const headers = new Headers(init.headers);
    assert.equal(headers.get("authorization"), "Bearer test-openrouter-key");
    assert.equal(headers.get("x-api-key"), null);
    assert.equal(JSON.parse(init.body).model, "anthropic/claude-sonnet-5");
    return Response.json({ id: "msg_test", type: "message", role: "assistant", content: [{ type: "text", text: "edited" }], model: "anthropic/claude-sonnet-5", stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 4 } });
  };
  const result = await textClient().messages.create({ model: "anthropic/claude-sonnet-5", max_tokens: 50, messages: [{ role: "user", content: "edit" }] });
  assert.equal(result.content[0].text, "edited");
  assert.equal(calls, 1);
}));

test("missing OpenRouter key and provider errors never retry through direct credentials", () => isolated(async () => {
  delete process.env.OPENROUTER_API_KEY;
  globalThis.fetch = async () => { throw new Error("Unexpected request"); };
  assert.equal(textClient(), null);
  await assert.rejects(generateImages({ prompt: "test", style: "illustrative", size: "cover", model: models.image }), /OPENROUTER_API_KEY/);
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: { message: "PRIVATE_UPSTREAM_DETAIL" } }, { status: 401 }); };
  await assert.rejects(textClient().messages.create({ model: "anthropic/claude-sonnet-5", max_tokens: 50, messages: [{ role: "user", content: "test" }] }), error => /OpenRouter/.test(error.message) && !error.message.includes("PRIVATE_UPSTREAM_DETAIL"));
  assert.equal(calls, 1);
  await assert.rejects(generateImages({ prompt: "test", style: "real", size: "square", model: models.image }), error => /401/.test(error.message) && !error.message.includes("PRIVATE_UPSTREAM_DETAIL"));
  assert.equal(calls, 2);
}));

test("image requests preserve aspect ratio, image count, cancellation and measured cost once", () => isolated(async () => {
  const controller = new AbortController();
  let requestSignal;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://openrouter.ai/api/v1/images");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "google/gemini-3.1-flash-image");
    assert.equal(body.aspect_ratio, "9:16");
    assert.equal(body.n, 2);
    assert.ok(body.prompt.includes("Style:"));
    requestSignal = init.signal;
    return Response.json({ data: [{ b64_json: png, media_type: "image/png" }, { b64_json: png, media_type: "image/png" }], usage: { cost: 0.075 } });
  };
  const result = await generateImages({ prompt: "test", style: "illustrative", size: "portrait", model: models.image, count: 2, signal: controller.signal });
  assert.equal(result.length, 2);
  assert.equal(result.reduce((sum, item) => sum + item.costCents, 0), 8);
  controller.abort();
  assert.equal(requestSignal.aborted, true);
  assert.throws(() => parseOpenRouterImages({ data: [{ b64_json: png, media_type: "image/svg+xml" }] }));
  assert.throws(() => parseOpenRouterImages({ data: [{ b64_json: Buffer.from("not an image").toString("base64"), media_type: "image/png" }] }));
  assert.throws(() => parseOpenRouterImages({ data: [{ url: "http://127.0.0.1/private" }] }));
}));

test("full editorial generation retains independent fields, usage and real progress via OpenRouter", () => isolated(async () => {
  const output = await build({ entryPoints: ["lib/ai/editorial.ts"], bundle: true, platform: "node", format: "cjs", packages: "external", write: false });
  const compiled = { exports: {} };
  new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://openrouter.ai/api/v1/messages");
    const request = JSON.parse(init.body);
    const text = request.model.includes("opus") ? JSON.stringify({ title: "عنوان مقترح", excerpt: "موجز مقترح", seoTitle: "عنوان بحث", seoDescription: "وصف البحث", keywords: ["تقنية"], section: "technology", format: "news", seriesSlug: null }) : "متن محرر يحافظ على المعلومات.";
    assert.equal(request.stream, true);
    return messageResponse(request, text);
  };
  const stages = [];
  const settings = { models: effectiveModels(models), tone: "نبرة اختبار", governance: { editorialGuard: false, requireImageRights: true } };
  const result = await compiled.exports.runEditorialTool("full_edit", { title: "المصدر", body: "متن المصدر" }, settings, { onFullEditProgress: stage => stages.push(stage) });
  assert.equal(result.fullEdit.title.text, "عنوان مقترح");
  assert.equal(result.fullEdit.body.text, "متن محرر يحافظ على المعلومات.");
  assert.deepEqual(result.fullEdit.seo.keywords, ["تقنية"]);
  assert.equal(result.usages.length, 2);
  assert.equal(stages[0], "accepted");
  assert.equal(stages.at(-1), "complete");
  for (const stage of ["body_started", "pack_started", "body_ready", "pack_ready", "guard_checking"]) assert.ok(stages.includes(stage));
}));

test("metadata generation uses one request and returns only complete validated supplements", () => isolated(async () => {
  const output=await build({entryPoints:['lib/ai/editorial.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false});
  const compiled={exports:{}};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
  const pack={title:'ignored title',body:'ignored body',excerpt:'موجز المادة',seoTitle:'عنوان بحث',seoDescription:'وصف نتائج البحث',keywords:['#تقنية','علوم','تقنية'],section:'sciences',format:'reports',seriesSlug:'limatha'};
  let calls=0,malformed=false;
  globalThis.fetch=async(_url,init)=>{calls++;const request=JSON.parse(init.body);const repair=request.messages[0].content.startsWith('المحاولة السابقة');assert.equal(request.model,'anthropic/claude-opus-5');if(!repair)assert.match(request.messages[0].content,/ملحقات المادة فقط/);return Response.json({id:'msg_test',type:'message',role:'assistant',content:[{type:'text',text:malformed?'invalid JSON':JSON.stringify(pack)}],model:request.model,stop_reason:'end_turn',usage:{input_tokens:10,output_tokens:4}})};
  const settings={models:effectiveModels(models),tone:'اختبار',governance:{editorialGuard:false,requireImageRights:true}};
  const input={title:'العنوان الأصلي',body:'المتن الأصلي'};
  const result=await compiled.exports.runEditorialTool('metadata',input,settings);
  assert.equal(calls,1);assert.equal(result.fullEdit,undefined);assert.deepEqual(Object.keys(result.metadata).sort(),['classify','excerpt','seo']);
  assert.deepEqual(result.metadata.seo.keywords,['تقنية','علوم']);assert.equal(result.metadata.classify.seriesSlug,'limatha');
  assert.deepEqual(input,{title:'العنوان الأصلي',body:'المتن الأصلي'});
  pack.section='unknown';await assert.rejects(compiled.exports.runEditorialTool('metadata',input,settings),{name:'EditorialOutputError',message:/ناقصة/});
  pack.section='sciences';pack.excerpt='س'.repeat(501);await assert.rejects(compiled.exports.runEditorialTool('metadata',input,settings),{name:'EditorialOutputError',message:/500 حرفًا/});
  pack.excerpt='موجز';pack.seriesSlug='imaginary-series';await assert.rejects(compiled.exports.runEditorialTool('metadata',input,settings),/ناقصة/);
  pack.seriesSlug=null;pack.seoTitle='';await assert.rejects(compiled.exports.runEditorialTool('metadata',input,settings),/ناقصة/);
  malformed=true;await assert.rejects(compiled.exports.runEditorialTool('metadata',input,settings),{name:'EditorialOutputError',message:/تعذر قراءة مخرج النموذج/});
}));


test("full edit waits for both calls and preserves completed usage when the other is rejected", () => isolated(async () => {
  const subject = await editorialModule();
  const settings = { models: effectiveModels(models), tone: "اختبار", governance: { editorialGuard: false } };
  const usages = []; const uncertain = [];
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    if (request.model.includes("opus")) return Response.json({ error: { message: "rejected" } }, { status: 429 });
    await new Promise(resolve => setTimeout(resolve, 25));
    return messageResponse(request, "المتن المكتمل.");
  };
  await assert.rejects(subject.runEditorialTool("full_edit", { title: "اختبار", body: "نص" }, settings, { onUsage: usage => usages.push(usage), onUnmeasured: cents => uncertain.push(cents) }), /429/);
  assert.equal(usages.length, 1); assert.equal(usages[0].outputTokens, 4); assert.deepEqual(uncertain, []);
}));

test("invalid or truncated output retains actual usage and never exposes incomplete full edit", () => isolated(async () => {
  const subject = await editorialModule();
  const settings = { models: effectiveModels(models), tone: "اختبار", governance: { editorialGuard: false } };
  let truncated = false; let count = 0;
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    return messageResponse(request, request.model.includes("opus") ? "invalid-json" : "المتن", { stop: truncated ? "max_tokens" : "end_turn" });
  };
  await assert.rejects(subject.runEditorialTool("full_edit", { title: "اختبار", body: "نص" }, settings, { onUsage: () => count++ }), /قراءة ملحقات/);
  assert.equal(count, 2);
  truncated = true;
  await assert.rejects(subject.runEditorialTool("full_edit", { title: "اختبار", body: "نص" }, settings, { onUsage: () => count++ }), /قبل اكتمالها/);
  assert.equal(count, 4);
}));

test("uncertain transport retains only its request estimate; explicit rejection and pre-cancel retain none", () => isolated(async () => {
  const subject = await editorialModule();
  const settings = { models: effectiveModels(models), tone: "اختبار", governance: { editorialGuard: false } };
  const input = { title: "اختبار", body: "نص" };
  const uncertain = [];
  globalThis.fetch = async () => { throw new TypeError("network failure"); };
  await assert.rejects(subject.runEditorialTool("metadata", input, settings, { onUnmeasured: value => uncertain.push(value) }));
  assert.equal(uncertain.length, 1);
  assert.ok(uncertain[0] > 0 && uncertain[0] < subject.editorialReservationCents("metadata", input, settings));
  assert.ok(uncertain[0] < 500);
  const full = subject.editorialReservationCents("full_edit", input, settings);
  assert.ok(full > uncertain[0] && full < 500);
  assert.ok(subject.editorialReservationCents("metadata", { ...input, body: "نص عربي ".repeat(2000) }, settings) > uncertain[0]);
  globalThis.fetch = async () => Response.json({ error: { message: "rejected" } }, { status: 401 });
  await assert.rejects(subject.runEditorialTool("metadata", input, settings, { onUnmeasured: value => uncertain.push(value) }));
  assert.equal(uncertain.length, 1);
  globalThis.fetch = async () => { throw new Error("must not request"); };
  await assert.rejects(subject.runEditorialTool("full_edit", input, settings, { signal: AbortSignal.abort(), onUnmeasured: value => uncertain.push(value) }), /قبل إرساله/);
  assert.equal(uncertain.length, 1);
}));

test("full-edit streaming deadline stops both calls and retains uncertain consumption", () => isolated(async () => {
  const subject = await editorialModule();
  const settings = { models: effectiveModels(models), tone: "اختبار", governance: { editorialGuard: false } };
  const timeout = AbortSignal.timeout; const deadlines = []; const uncertain = []; let requests = 0;
  AbortSignal.timeout = ms => { assert.equal(ms, 120_000); const controller = new AbortController(); deadlines.push(controller); return controller.signal; };
  globalThis.fetch = async (_url, init) => {
    requests++;
    return new Promise((_resolve,reject) => { init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}); });
  };
  try {
    const pending = subject.runEditorialTool('full_edit',{title:'اختبار',body:'نص'},settings,{onUnmeasured:cents=>uncertain.push(cents)});
    const rejected = assert.rejects(pending,/انتهت مهلة مزوّد الذكاء بعد دقيقتين/);
    while(requests<2)await new Promise(resolve=>setImmediate(resolve));
    for(const deadline of deadlines)deadline.abort();
    await rejected;
    assert.equal(uncertain.length,2);assert.equal(requests,2);
  } finally { AbortSignal.timeout=timeout; }
}));
