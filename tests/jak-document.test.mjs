import assert from "node:assert/strict";
import test from "node:test";
import { buildJakDocument, jakDocumentHeaders, JAK_SANDBOX } from "../lib/jak-report-document.ts";

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
