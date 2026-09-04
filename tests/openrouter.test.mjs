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
  assert.equal(aiProvider({ OPENROUTER_API_KEY: "test-key" }), "openrouter");
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
    const text = request.model.includes("haiku") ? JSON.stringify({ title: "عنوان مقترح", excerpt: "موجز مقترح", seoTitle: "عنوان بحث", seoDescription: "وصف البحث", keywords: ["تقنية"], section: "technology", format: "news", seriesSlug: null }) : "متن محرر يحافظ على المعلومات.";
    return Response.json({ id: "msg_test", type: "message", role: "assistant", content: [{ type: "text", text }], model: request.model, stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 4 } });
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
