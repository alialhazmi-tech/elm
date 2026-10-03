import assert from "node:assert/strict";
import test from "node:test";
import { parseDocument } from "htmlparser2";
import { buildPublicJakDocument, publicJakDocumentHeaders } from "../lib/jak-public-document.ts";

const baseReport = {
  id: "11111111-1111-4111-8111-111111111111",
  publicNumber: 12,
  slug: "اقتصاد-الحرب",
  title: "اقتصاد الحرب",
  excerpt: "شرح بصري موثق للسياق والنتائج.",
  image: "https://jakelelm.alelm.net/wp-content/uploads/2026/08/cover.webp",
  html: "<section id=\"report\"><p>BODY_MARKER</p></section>",
  css: ".report{color:red}",
  showOnHomepage: true,
  status: "published",
  authorId: null,
  version: 1,
  createdAt: "2026-10-03T00:00:00.000Z",
  updatedAt: "2026-10-03T00:00:00.000Z",
  publishedAt: "2026-10-03T00:00:00.000Z",
  sourceUrl: null,
  sourcePostId: null,
  sourcePublishedAt: "2026-10-02T00:00:00.000Z",
  sourceModifiedAt: null,
};

function elements(root, name) {
  const result = [];
  const visit = (node) => {
    for (const child of node.children ?? []) {
      if (child.type === "tag" || child.type === "script" || child.type === "style") {
        if (!name || child.name === name) result.push(child);
        visit(child);
      }
    }
  };
  visit(root);
  return result;
}

test("native public document replaces source head metadata while preserving raw report code", () => {
  const report = {
    ...baseReport,
    html: "<!doctype html><html lang=\"en\" dir=\"ltr\"><head>"
      + "<title>Source title</title>"
      + "<meta charset=\"iso-8859-1\"><meta name=\"viewport\" content=\"bad\">"
      + "<meta name=\"description\" content=\"evil description\"><meta name=\"robots\" content=\"noindex, nofollow\">"
      + "<meta property=\"og:title\" content=\"evil og\"><meta name=\"twitter:title\" content=\"evil twitter\">"
      + "<link rel=\"canonical\" href=\"https://evil.example/\"><base href=\"https://evil.example/\">"
      + "<meta http-equiv=\"refresh\" content=\"0;url=https://evil.example/\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src *\">"
      + "<meta property=\"article:published_time\" content=\"1999-01-01\">"
      + "<meta name=\"theme-color\" content=\"#123456\">"
      + "<script>const marker = \"<title>evil</title>\\\\n</head>\";</script>"
      + "<style>.source-rule{color:blue}</style>"
      + "</head><body><div id=\"report\">BODY_MARKER</div><script>window.rawMarker = \"</head>\";</script></body></html>",
  };
  const output = buildPublicJakDocument(report);
  const parsed = parseDocument(output);
  const head = elements(parsed, "head")[0];
  const body = elements(parsed, "body")[0];
  assert.ok(head);
  assert.ok(body);
  assert.equal(elements(head, "title").length, 1);
  assert.equal(elements(head, "meta").filter((element) => element.attribs.name === "description").length, 1);
  assert.equal(elements(head, "link").filter((element) => (element.attribs.rel ?? "").includes("canonical")).length, 1);
  assert.equal(elements(head, "base").length, 0);
  assert.equal(elements(head, "meta").filter((element) => ["refresh", "content-security-policy"].includes((element.attribs["http-equiv"] ?? "").toLowerCase())).length, 0);
  assert.equal(elements(head, "meta").filter((element) => (element.attribs.name ?? "").toLowerCase() === "robots" && element.attribs.content === "noindex, nofollow").length, 0);
  assert.match(output, /<html lang="ar" dir="rtl">/);
  assert.match(output, /<meta name="robots" content="index, follow">/);
  assert.match(output, /BODY_MARKER/);
  assert.equal(elements(head, "meta").filter(e=>e.attribs.property === "article:published_time").length, 1);
  assert.doesNotMatch(output, /1999-01-01/);
  assert.match(output, /const marker = "<title>evil<\/title>\\\\n<\/head>";/);
  assert.match(output, /window\.rawMarker = "<\/head>"/);
  assert.match(output, /\.source-rule\{color:blue\}/);
  assert.match(output, /class="jak-public-document__back-link" href="\/jak"/);
  assert.match(output, /class="jak-public-document__title">اقتصاد الحرب<\/h1>/);
  assert.doesNotMatch(output, /<iframe\b/i);

  const canonical = elements(head, "link").find((element) => (element.attribs.rel ?? "").includes("canonical"));
  assert.equal(canonical.attribs.href, "https://alelm.net/jak/12/%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF-%D8%A7%D9%84%D8%AD%D8%B1%D8%A8");
  assert.match(output, /property="og:image" content="https:\/\/alelm\.net\/share-images\//);
  assert.match(output, /name="twitter:image" content="https:\/\/alelm\.net\/share-images\//);
});

test("fragment documents get RTL metadata and do not duplicate an existing h1", () => {
  const output = buildPublicJakDocument({
    ...baseReport,
    title: "عنوان & اختبار",
    excerpt: "وصف <اختبار> مع \"علامة\".",
    html: "<main><h1>العنوان المرئي</h1><p>المحتوى الأصلي</p></main>",
    css: "",
  });
  assert.match(output, /^<!doctype html><html lang="ar" dir="rtl"><head>/i);
  assert.equal((output.match(/<h1\b/gi) ?? []).length, 1);
  assert.match(output, /<meta name="description" content="وصف &lt;اختبار&gt; مع &quot;علامة&quot;\.">/);
  assert.match(output, /<title>عنوان &amp; اختبار \| جاك العلم<\/title>/);
  assert.match(output, /<main><h1>العنوان المرئي<\/h1><p>المحتوى الأصلي<\/p><\/main>/);
});

test("public response headers retain opaque sandbox protections and allow indexing", () => {
  const headers = publicJakDocumentHeaders();
  const csp = headers["Content-Security-Policy"];
  assert.equal(headers["Content-Type"], "text/html; charset=utf-8");
  assert.equal(headers["Cache-Control"], "private, no-store");
  assert.equal(headers["X-Robots-Tag"], "index, follow");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.match(csp, /sandbox allow-scripts/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.doesNotMatch(csp, /allow-same-origin|allow-forms|unsafe-eval/);
});

test("metadata values are escaped without turning source script text into head markup", () => {
  const output = buildPublicJakDocument({
    ...baseReport,
    title: "عنوان & <اختبار> \"اقتباس\"",
    excerpt: "وصف & <اختبار> \"اقتباس\"",
    html: "<script>const literal = '<title>source</title></head>';</script><p>نص</p>",
    css: "",
  });
  assert.match(output, /<title>عنوان &amp; &lt;اختبار&gt; &quot;اقتباس&quot; \| جاك العلم<\/title>/);
  assert.match(output, /<meta name="description" content="وصف &amp; &lt;اختبار&gt; &quot;اقتباس&quot;">/);
  assert.match(output, /const literal = '<title>source<\/title><\/head>';<\/script>/);
});

test("incomplete HTML and fragment metadata still receive a complete public envelope", () => {
  for (const html of [
    '<head><title>old</title><meta name="robots" content="noindex"></head><p>INCOMPLETE_BODY</p>',
    '<html><head><title>old</title></head><p>INCOMPLETE_BODY</p></html>',
    '<meta name="robots" content="noindex"><main>INCOMPLETE_BODY</main>',
  ]) {
    const output = buildPublicJakDocument({ ...baseReport, html, css: '' });
    const parsed = parseDocument(output);
    assert.equal(elements(parsed, 'html').length, 1);
    assert.equal(elements(parsed, 'head').length, 1);
    assert.equal(elements(parsed, 'body').length, 1);
    assert.equal(elements(parsed, 'title').length, 1);
    assert.equal(elements(parsed, 'link').filter(e=>e.attribs.rel === 'canonical').length, 1);
    assert.match(output, /INCOMPLETE_BODY/);
    assert.match(output, /العودة إلى جاك العلم/);
    assert.doesNotMatch(output, /noindex/);
  }
});

test("native document preserves custom root attributes and handles self-closing syntax", () => {
  const output = buildPublicJakDocument({ ...baseReport, html:'<html class="theme" data-mode="report" style="color:red" lang="en" dir="ltr"><head></head><body>BODY</body></html>' });
  const html = elements(parseDocument(output), 'html')[0];
  assert.equal(html.attribs.class, 'theme');
  assert.equal(html.attribs['data-mode'], 'report');
  assert.equal(html.attribs.style, 'color:red');
  assert.equal(html.attribs.lang, 'ar');
  assert.equal(html.attribs.dir, 'rtl');
  assert.match(buildPublicJakDocument({ ...baseReport, html:'<html/><head></head><body>BODY</body>' }), /BODY/);
});

 test("embedded SVG retains its accessible artwork title", () => {
   const output = buildPublicJakDocument({ ...baseReport, html:'<main><svg><title>وصف الرسم</title><path d="M0 0"/></svg></main>' });
   assert.match(output, /<svg><title>وصف الرسم<\/title>/);
 });
