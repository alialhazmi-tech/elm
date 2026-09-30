import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildJakDocument, isMobileJakReader, jakDocumentHeaders, JAK_SANDBOX } from "../lib/jak-report-document.ts";

test("mobile FIFA bounds image decoding and disables optional animation while retaining layout and source", () => {
  const image = '<img class="bg-photo" src="https://jakelelm.alelm.net/wp-content/uploads/2026/08/page1-bg.webp" alt="غلاف">';
  const html = `<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script><script>function rescale(){ return 1920; } rescale();</script>${image.repeat(3)}<a href="https://alelm.net/sport/262093/example">اقرأ المزيد</a>`;
  const report = { html, css: ".page-stage{width:1920px}", title: "الفيفا", sourcePostId: 1956 };
  const mobile = buildJakDocument(report, { mobile: true });
  assert.doesNotMatch(mobile, /<script src=/);
  assert.match(mobile, /function rescale/);
  assert.equal((mobile.match(/loading="eager"/g) ?? []).length, 2);
  assert.equal((mobile.match(/loading="lazy"/g) ?? []).length, 1);
  assert.equal((mobile.match(/decoding="async"/g) ?? []).length, 3);
  assert.match(mobile, /image-variants\?src=https%3A%2F%2Fjakelelm\.alelm\.net/);
  assert.match(mobile, /&amp;w=1080/);
  assert.match(mobile, /اقرأ المزيد/);
  assert.match(buildJakDocument(report), /<script src=/);
  assert.match(buildJakDocument({ ...report, sourcePostId: 40 }, { mobile: true }), /<script src=/);
  assert.equal(report.html, html);
  assert.equal(isMobileJakReader("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari"), true);
  assert.equal(isMobileJakReader("Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit Safari"), false);
});

test("legacy document preserves scenes, inline scripts and CSS while replacing the stylesheet placeholder", () => {
  const html = '<!DOCTYPE html><html dir="rtl"><head><link rel="stylesheet" href="style.css"></head><body><section id="scene">نص كامل</section><script>document.body.dataset.ready="yes"</script></body></html>';
  const result = buildJakDocument({ html, css: "@import url('https://fonts.googleapis.com/css2?family=Readex+Pro'); #scene{color:red}", title: 'تقرير <اختبار>' });
  assert.match(result, /<section id="scene">نص كامل<\/section>/);
  assert.match(result, /<script>document.body.dataset.ready="yes"<\/script>/);
  assert.match(result, /@import url/);
  assert.match(result, /#scene\{color:red\}/);
  assert.doesNotMatch(result, /href="style.css"/);
  assert.match(result, /تقرير &lt;اختبار&gt;/);
  assert.match(html, /href="style.css"/, "the source is never rewritten in storage");
});

test("fragment and embedded-style reports remain executable only in the dedicated sandbox", () => {
  const html = '<style>.page{height:100vh}</style><section class="page">نص</section>';
  assert.ok(buildJakDocument({ html, css: "", title: "تقرير" }).includes(html));
  const headers = jakDocumentHeaders();
  const csp = headers["Content-Security-Policy"];
  assert.match(csp, /sandbox allow-scripts/);
  assert.doesNotMatch(csp, /allow-same-origin|allow-top-navigation|unsafe-eval/);
  assert.doesNotMatch(JAK_SANDBOX, /allow-same-origin|allow-forms/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /script-src 'unsafe-inline' https:\/\/cdnjs.cloudflare.com\/ajax\/libs\/gsap\/3.12.5\//);
  assert.equal(headers["Cache-Control"], "private, no-store");
  assert.equal(headers["X-Robots-Tag"], "noindex, nofollow");
});

test("separate CSS cannot close its style element", () => {
  const result = buildJakDocument({ html: "<p>محتوى</p>", css: '</style><script>alert(1)</script>', title: "تقرير" });
  assert.equal((result.match(/<\/style>/g) ?? []).length, 1);
  assert.match(result, /<\\\/style>/);
});

test("built routing excludes only the sandbox documents from application frame denial", async () => {
  const routes = JSON.parse(await readFile(`${process.env.NEXT_DIST_DIR ?? ".next-gate"}/routes-manifest.json`, "utf8"));
  const policies = (path) => routes.headers.filter((rule) => new RegExp(rule.regex).test(path)).flatMap((rule) => rule.headers).filter((header) => ["Content-Security-Policy", "X-Frame-Options"].includes(header.key));
  assert.deepEqual(policies("/api/jak-reports/example/document"), []);
  assert.deepEqual(policies("/api/tahrir/jak-reports/preview"), []);
  for (const path of ["/", "/tahrir", "/jak", "/api/tahrir/jak-reports", "/api/jak-reports/example/document/extra"]) {
    assert.ok(policies(path).some((header) => header.key === "X-Frame-Options" && header.value === "DENY"), path);
  }
});
