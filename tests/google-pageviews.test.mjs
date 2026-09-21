import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { analyticsUrl, createPageviewTracker } from "../lib/analytics/pageviews.ts";

test("sends initial and virtual pageviews once, including a return to a previous page", () => {
  const sent = [];
  const tracker = createPageviewTracker((event, referrer) => sent.push({ ...event, referrer }));
  const home = "https://alelm.net/";
  const article = "https://alelm.net/sciences/123/story";
  assert.equal(tracker.track(home, "العلم", "https://www.google.com/search?q=example"), true);
  assert.equal(tracker.track(home, "العلم", ""), false);
  assert.equal(tracker.track(home + "#main-content", "العلم", ""), false);
  assert.equal(tracker.track(article, "عنوان الخبر | العلم", ""), true);
  assert.equal(tracker.track(article, "عنوان الخبر | العلم", ""), false);
  assert.equal(tracker.track(home, "العلم", ""), true);
  assert.deepEqual(sent, [
    { event: "Pageview", pagePath: home, pageTitle: "العلم", referrer: "https://www.google.com/search" },
    { event: "Pageview", pagePath: article, pageTitle: "عنوان الخبر | العلم", referrer: home },
    { event: "Pageview", pagePath: home, pageTitle: "العلم", referrer: article },
  ]);
});

test("tracks distinct searches without sending search text or arbitrary URL parameters", () => {
  const events = [];
  const tracker = createPageviewTracker(event => events.push(event));
  tracker.track("https://alelm.net/search?q=one", "البحث | العلم", "");
  tracker.track("https://alelm.net/search?q=two", "البحث | العلم", "");
  tracker.track("https://alelm.net/search?q=two", "البحث | العلم", "");
  assert.equal(events.length, 2);
  assert.ok(events.every(event => event.pagePath === "https://alelm.net/search"));
  assert.equal(analyticsUrl("https://alelm.net/politics?utm_source=x&utm_campaign=news&p=2&token=secret&email=a%40b.com#section"),
    "https://alelm.net/politics?utm_source=x&utm_campaign=news&p=2");
  assert.equal(analyticsUrl("https://alelm.net/?utm_campaign=a%40b.com"), "https://alelm.net/");
});

test("Arabic canonical replacements do not create extra pageviews or an empty-title event", () => {
  const sent = [];
  const tracker = createPageviewTracker(event => sent.push(event));
  const prefix = "https://alelm.net/politics/263004/";
  const slug = "تود-بلانش";
  tracker.track(prefix + encodeURIComponent(slug).toLowerCase(), "عنوان الخبر", "");
  tracker.track(prefix + encodeURIComponent(encodeURIComponent(slug).toLowerCase()), "", "");
  tracker.track(prefix + slug, "عنوان الخبر", "");
  assert.deepEqual(sent, [{ event: "Pageview", pagePath: prefix + encodeURIComponent(slug), pageTitle: "عنوان الخبر" }]);
  assert.equal(analyticsUrl("https://alelm.net/keywords/a%2Fb"), "https://alelm.net/keywords/a%2Fb");
});

test("excludes account, recovery and editorial routes and their referrers", () => {
  for (const path of ["/tahrir", "/tahrir/editor/id", "/tahrir/recover?token=secret", "/join/reset?token=secret", "/account/verify-email", "/api/auth/callback", "/prototype/membership", "/%74ahrir/editor/id"]) {
    assert.equal(analyticsUrl("https://alelm.net" + path), null, path);
  }
  const sent = [];
  const tracker = createPageviewTracker((event, referrer) => sent.push({ ...event, referrer }));
  tracker.track("https://alelm.net/", "العلم", "https://alelm.net/tahrir/editor/id");
  tracker.track("https://alelm.net/tahrir/recover?token=secret", "استعادة الحساب", "");
  tracker.track("https://alelm.net/", "العلم", "");
  assert.equal(sent.length, 2);
  assert.ok(sent.every(event => event.referrer === ""));
  assert.equal(analyticsUrl("not a URL"), null);
  assert.equal(analyticsUrl("javascript:alert(1)"), null);
});

test("a failed optional sender can retry without losing or duplicating a pageview", () => {
  let fail = true;
  const sent = [];
  const tracker = createPageviewTracker(event => {
    if (fail) throw new Error("blocked");
    sent.push(event);
  });
  assert.throws(() => tracker.track("https://alelm.net/", "العلم", ""));
  fail = false;
  tracker.track("https://alelm.net/", "العلم", "");
  tracker.track("https://alelm.net/", "العلم", "");
  assert.equal(sent.length, 1);
});

test("the route hook waits for committed metadata, cancels abandoned effects and does not duplicate Strict Mode mounts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "alelm-pageviews-"));
  const originals = Object.fromEntries(["window", "document", "requestAnimationFrame", "cancelAnimationFrame"].map(key => [key, globalThis[key]]));
  const frames = new Map();
  const effects = [];
  let id = 0;
  globalThis.window = { location: { href: "https://alelm.net/" }, dataLayer: [] };
  globalThis.document = { title: "العلم", referrer: "https://www.google.com/" };
  globalThis.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
  globalThis.cancelAnimationFrame = key => frames.delete(key);
  globalThis.__pageviewHooks = {
    useEffect: fn => effects.push(fn),
    usePathname: () => new URL(window.location.href).pathname,
    useSearchParams: () => new URL(window.location.href).searchParams,
  };
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  try {
    await build({
      entryPoints: ["app/_components/google-pageviews.tsx"], outfile: join(dir, "component.mjs"),
      bundle: true, format: "esm", platform: "node",
      plugins: [{ name: "router-hooks", setup(b) {
        b.onResolve({ filter: /^(react|next\/navigation)$/ }, () => ({ path: "hooks", namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const {useEffect,usePathname,useSearchParams}=globalThis.__pageviewHooks;", loader: "js" }));
      } }],
    });
    const { GooglePageviews } = await import(join(dir, "component.mjs"));
    const mount = () => { GooglePageviews(); return effects.pop()(); };
    mount()(); // Strict Mode cleanup before the first animation frame.
    mount(); flush();
    mount(); flush(); // Remount of an already committed URL.
    assert.equal(window.dataLayer.filter(item => item.event === "Pageview").length, 1);

    window.location.href = "https://alelm.net/sciences/123/story";
    mount();
    document.title = "العنوان الجديد | العلم";
    flush();
    const events = window.dataLayer.filter(item => item.event === "Pageview");
    assert.equal(events.length, 2);
    assert.equal(events[1].pageTitle, "العنوان الجديد | العلم");
    assert.equal(events[1].pagePath, window.location.href);
    assert.deepEqual(Array.from(window.dataLayer[2]), ["set", { page_referrer: "https://alelm.net/" }]);

    window.location.href = "https://alelm.net/tahrir/recover?token=secret";
    mount(); flush();
    assert.equal(window.dataLayer.length, 4);

    window.location.href = "https://alelm.net/search?q=first";
    const cancel = mount();
    cancel();
    window.location.href = "https://alelm.net/search?q=second";
    document.title = "البحث | العلم";
    mount(); flush();
    assert.equal(window.dataLayer.filter(item => item.event === "Pageview").length, 3);
    assert.equal(JSON.stringify(window.dataLayer).includes("secret"), false);
  } finally {
    Object.assign(globalThis, originals);
    delete globalThis.__pageviewHooks;
    await rm(dir, { recursive: true, force: true });
  }
});
