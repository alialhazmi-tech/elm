import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { build } from "esbuild";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/** حامل خطافات يدوي بمؤقتات افتراضية — نمط tests/draft-autosave.test.mjs مع useCallback. */
function harness() {
  const slots = []; let index = 0, dirty = false, component, value, now = 0, serial = 0;
  const effects = []; const timers = new Map();
  const hooks = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], next => { const v = typeof next === "function" ? next(slots[i]) : next; if (!Object.is(slots[i], v)) { slots[i] = v; dirty = true; } }]; },
    useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = index++; const prev = slots[i]; if (!prev || !deps || deps.some((d, j) => !Object.is(d, prev.deps[j]))) slots[i] = { deps, fn }; return slots[i].fn; },
    useEffect(fn, deps) { const i = index++; const prev = slots[i]; if (!prev || !deps || deps.some((d, j) => !Object.is(d, prev.deps[j]))) { slots[i] = { deps, cleanup: prev?.cleanup }; effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const browser = { setTimeout(fn, delay) { const id = ++serial; timers.set(id, { at: now + delay, fn }); return id; }, clearTimeout(id) { timers.delete(id); } };
  function render() { do { dirty = false; index = 0; value = component(); while (effects.length) effects.shift()(); } while (dirty); return value; }
  return {
    hooks, browser, render, get value() { return value; }, mount(fn) { component = fn; return render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    async tick(ms) { const end = now + ms; let due; while ((due = [...timers].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0])) { now = due[1].at; timers.delete(due[0]); due[1].fn(); await new Promise(r => setImmediate(r)); render(); } now = end; await new Promise(r => setImmediate(r)); render(); },
  };
}

test("الحارس الحي والخادم يفحصان المسودة نفسها: النص والصورة والشكل و«عاجل» ومصادر المتن", async () => {
  const [draftBuilder, route] = await Promise.all([read("lib/tahrir/guard-draft.ts"), read("app/api/tahrir/guard/route.ts")]);
  // مسار الفحص الحي والمسارات الخادمية تمر كلها عبر مسودة الحارس الموحدة.
  assert.match(route, /buildGuardDraft\(\{ title, body, format, image, breakingUntil, media \}\)/);
  assert.match(route, /loadGuardContext\(settingsPromise, gate\.actor\.userId\)/);
  assert.match(route, /guardMediaFor\(image\)/);
  assert.match(route, /runConfiguredPolicyGuard/);
  assert.match(route, /settings\.governance/);
  assert.match(route, /status: 413/);
  assert.match(draftBuilder, /surface: input\.format === "jakalelm" \? "design" : undefined/);
  assert.match(draftBuilder, /breaking: isBreakingActive\(input\.breakingUntil, input\.now\)/);
  assert.match(draftBuilder, /sourceUrls: extractSourceUrls\(input\.body\)/);
  for (const path of ["app/api/tahrir/story/submit/route.ts", "app/api/tahrir/story/publish/route.ts", "app/api/tahrir/story/schedule/route.ts", "lib/tahrir/service.ts"]) {
    const source = await read(path);
    assert.match(source, /buildGuardDraft\(\{ id: story\.id, title: story\.title, body: story\.body, format: story\.format, image: story\.image, breakingUntil: story\.breakingUntil, media/, path);
    assert.match(source, /loadGuardContext\(/, path);
  }
});

test("الحارس الحي: يرسل breakingUntil، يلغي الطلب السابق، ولا يفتح البوابة قبل فحص ناجح", async () => {
  await mkdir(`${process.cwd()}/tmp`, { recursive: true });
  const dir = await mkdtemp(`${process.cwd()}/tmp/live-guard-`);
  const originals = { window: globalThis.window, fetch: globalThis.fetch };
  const h = harness(); globalThis.__guardHooks = h.hooks; globalThis.window = h.browser;
  const requests = []; let mode = "ok";
  globalThis.fetch = async (url, options) => {
    const request = { url, body: JSON.parse(options.body), signal: options.signal };
    requests.push(request);
    if (mode === "fail") throw new TypeError("Failed to fetch");
    if (mode === "500") return Response.json({ error: "x" }, { status: 500 });
    return Response.json({ ok: true, canRequestApproval: true, findings: [], counts: { blocking: 0, warning: 0, suggestion: 0 }, rulesEvaluated: 39, audit: { blockingRuleIds: [] } });
  };
  try {
    await build({ stdin: { contents: "export { useLiveGuard, GUARD_DEBOUNCE_MS } from './components/tahrir/editor/use-live-guard';", loader: "ts", resolveDir: process.cwd() }, outfile: `${dir}/hook.mjs`, bundle: true, format: "esm", platform: "node", packages: "external", plugins: [{ name: "hooks", setup(b) { b.onResolve({ filter: /^react$/ }, () => ({ path: "react", namespace: "fixture" })); b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ loader: "js", contents: "const h=()=>globalThis.__guardHooks;export const useState=(...a)=>h().useState(...a),useRef=(...a)=>h().useRef(...a),useEffect=(...a)=>h().useEffect(...a),useEffectEvent=(...a)=>h().useEffectEvent(...a),useCallback=(...a)=>h().useCallback(...a)" })); } }] });
    const { useLiveGuard, GUARD_DEBOUNCE_MS } = await import(`${dir}/hook.mjs`);
    let input = { title: "عنوان", body: "<p>متن <a href=\"https://www.spa.gov.sa/w1\">واس</a></p>", image: "", format: "news", breakingUntil: "2099-01-01T00:00:00.000Z" };
    h.mount(() => useLiveGuard(input));
    // قبل الفحص الأول: مشغول والبوابة مغلقة
    assert.equal(h.value.guardBusy, true); assert.equal(h.value.gateOpen, false);
    await h.tick(0);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].body, { title: "عنوان", body: input.body, image: null, format: "news", breakingUntil: "2099-01-01T00:00:00.000Z" });
    assert.equal(requests[0].url, "/api/tahrir/guard");
    assert.equal(h.value.guardBusy, false); assert.equal(h.value.guardError, false); assert.equal(h.value.gateOpen, true);
    assert.equal(h.value.report.canRequestApproval, true);

    // فحصان متتاليان خلال المهلة: طلب واحد فقط بالقيم الأحدث، والبوابة تُغلق أثناء الانتظار
    h.value.scheduleGuard({ title: "أ" }); h.render();
    assert.equal(h.value.guardBusy, true); assert.equal(h.value.gateOpen, false);
    await h.tick(GUARD_DEBOUNCE_MS - 1); h.value.scheduleGuard({ title: "أب", image: "/uploads/x.webp" }); await h.tick(GUARD_DEBOUNCE_MS - 1);
    assert.equal(requests.length, 1);
    await h.tick(1);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].body.title, "أب"); assert.equal(requests[1].body.image, "/uploads/x.webp");
    assert.equal(requests[1].body.breakingUntil, "2099-01-01T00:00:00.000Z");

    // الفحص الفوري يلغي الطلب الحي السابق
    let release; mode = "hold";
    globalThis.fetch = async (url, options) => { requests.push({ url, body: JSON.parse(options.body), signal: options.signal }); await new Promise(resolve => { release = resolve; }); return Response.json({ ok: true, canRequestApproval: true, findings: [], counts: { blocking: 0, warning: 0, suggestion: 0 }, rulesEvaluated: 39, audit: { blockingRuleIds: [] } }); };
    const held = h.value.retryGuard({ title: "قديم" }); await new Promise(r => setImmediate(r));
    const heldSignal = requests.at(-1).signal;
    assert.equal(heldSignal.aborted, false);
    globalThis.fetch = async (url, options) => { requests.push({ url, body: JSON.parse(options.body), signal: options.signal }); throw new TypeError("Failed to fetch"); };
    await h.value.retryGuard({ title: "أحدث" }); h.render();
    assert.equal(heldSignal.aborted, true, "الطلب السابق يُلغى عند طلب أحدث");
    release(); await held; h.render();
    // فشل الأحدث يفرض حالة خطأ صريحة: لا تقرير، البوابة مغلقة، وليس «0 مخالفة»
    assert.equal(h.value.guardError, true); assert.equal(h.value.report, null); assert.equal(h.value.gateOpen, false); assert.equal(h.value.guardBusy, false);

    // ردّ 500 خطأ أيضًا، ثم «أعد الفحص» الناجح يفتح البوابة
    mode = "500"; globalThis.fetch = originals.fetch;
    globalThis.fetch = async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return Response.json({ error: "x" }, { status: 500 }); };
    await h.value.retryGuard(); h.render();
    assert.equal(h.value.guardError, true); assert.equal(h.value.gateOpen, false);
    globalThis.fetch = async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return Response.json({ ok: false, canRequestApproval: false, findings: [{ ruleId: "X", severity: "blocking", message: "م", field: "body", category: "body", policyRef: "" }], counts: { blocking: 1, warning: 0, suggestion: 0 }, rulesEvaluated: 39, audit: { blockingRuleIds: ["X"] } }); };
    await h.value.retryGuard(); h.render();
    assert.equal(h.value.guardError, false); assert.equal(h.value.gateOpen, false, "مخالفة قاطعة تغلق البوابة رغم نجاح الفحص");
    assert.equal(h.value.report.counts.blocking, 1);
    h.unmount();
  } finally {
    Object.assign(globalThis, originals); delete globalThis.__guardHooks;
    await rm(dir, { recursive: true, force: true });
  }
});

test("واجهة الحارس لا تفتح بوابة الاعتماد قبل اكتمال الفحص أو مع خطأ في الاتصال", async () => {
  const [hook, editor, guardPanel, actionBar] = await Promise.all([
    read("components/tahrir/editor/use-live-guard.ts"),
    read("components/tahrir/editor/editor-client.tsx"),
    read("components/tahrir/editor/guard-panel.tsx"),
    read("components/tahrir/editor/action-bar.tsx"),
  ]);
  assert.match(hook, /const gateOpen = !guardBusy && !guardError && report\?\.canRequestApproval === true/);
  assert.match(guardPanel, /جارٍ فحص المادة/);
  assert.match(guardPanel, /تعذر فحص الحارس/);
  assert.match(actionBar, /تعذر فحص الحارس/);
  assert.match(actionBar, /أعد الفحص/);
  // رفض الخادم (422) يعيد الفحص فورًا ويفتح تبويب الحارس، والقواعد القاطعة تُذكر بالاسم.
  assert.match(editor, /await guard\.retryGuard\(\{ body: bodyHtml\(\) \}\);\s*setInspectorTab\("guard"\)/);
  assert.match(await read("components/tahrir/editor/use-story-workflow.ts"), /blocking\.join\("، "\)/);
  assert.doesNotMatch(hook, /report \? report\.canRequestApproval : true/);
});
