import assert from "node:assert/strict";
import test from "node:test";

import {
  looksLikeHtml,
  sanitizeBodyHtml,
  stripHtmlToText,
  textToHtml,
} from "../lib/content/html.ts";

test("المنقّي يسقط script بمحتواه ولا يمرر أي سمة من الإدخال", () => {
  const dirty =
    '<p onclick="steal()">فقرة سليمة</p><script>alert(1)</script><img src=x onerror=alert(2)>';
  const clean = sanitizeBodyHtml(dirty);
  assert.equal(clean, "<p>فقرة سليمة</p>");
});

test("روابط javascript: تُسقط والوسم يبقى فارغ الرابط لا يمر", () => {
  const clean = sanitizeBodyHtml('<p><a href="javascript:alert(1)">اضغط</a></p>');
  assert.ok(!clean.includes("javascript:"));
  assert.ok(!clean.includes("<a "));
  assert.ok(clean.includes("اضغط"));
});

test("الروابط السليمة تُعاد ببناء نظيف مع rel للخارجي", () => {
  const clean = sanitizeBodyHtml('<p><a href="https://example.com" onclick="x()">مصدر</a></p>');
  assert.equal(
    clean,
    '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">مصدر</a></p>',
  );
  const internal = sanitizeBodyHtml('<p><a href="/series/absat">سلسلة</a></p>');
  assert.equal(internal, '<p><a href="/series/absat">سلسلة</a></p>');
});

test("b/i/div تتحول strong/em/p والمحاذاة الوسطى وحدها تمر", () => {
  const clean = sanitizeBodyHtml(
    '<div style="text-align:center; color:red"><b>غامق</b> و<i>مائل</i></div>',
  );
  assert.equal(clean, '<p style="text-align:center"><strong>غامق</strong> و<em>مائل</em></p>');
});

test("iframe وstyle يسقطان بمحتواهما والنص الحر يبقى", () => {
  const clean = sanitizeBodyHtml(
    "<style>body{}</style><iframe src=\"https://x\">إطار</iframe><h2>عنوان</h2>نص حر",
  );
  assert.equal(clean, "<h2>عنوان</h2>نص حر");
});

test("stripHtmlToText يعيد فقرات نظيفة والحارس يفحصها كنص", () => {
  const text = stripHtmlToText("<p>الأولى</p><h2>عنوان</h2><p>الثانية&nbsp;هنا</p>");
  assert.equal(text, "الأولى\n\nعنوان\n\nالثانية هنا");
});

test("النص الإرثي لا يتغير في strip واكتشاف HTML دقيق", () => {
  const legacy = "فقرة أولى\n\nفقرة ثانية";
  assert.equal(stripHtmlToText(legacy), legacy);
  assert.equal(looksLikeHtml(legacy), false);
  assert.equal(looksLikeHtml("<p>هيكل</p>"), true);
});

test("textToHtml يهرّب الأقواس ويقسم الفقرات", () => {
  assert.equal(textToHtml("أ < ب\n\nج"), "<p>أ &lt; ب</p><p>ج</p>");
});

test("embedded posts retain only a numeric identity and survive repeated saving between paragraphs", () => {
  const body = '<p>قبل التغريدة</p><blockquote data-x-post="1293593516040269825"><a href="https://x.com/i/status/1293593516040269825" target="_blank" rel="noopener noreferrer">عرض التغريدة على X</a></blockquote><p>بعد التغريدة</p>';
  assert.equal(sanitizeBodyHtml(body), body);
  assert.equal(sanitizeBodyHtml(sanitizeBodyHtml(body)), body);
  assert.equal(looksLikeHtml(body), true);
  assert.match(stripHtmlToText(body), /قبل التغريدة[\s\S]*بعد التغريدة/);
  for (const id of ['javascript:alert(1)', '0', '12&amp;34', '1 onmouseover=alert(1)', '123456789012345678901']) {
    assert.doesNotMatch(sanitizeBodyHtml(`<blockquote data-x-post="${id}" onclick="bad()">نص</blockquote>`), /data-x-post|onclick|javascript/);
  }
  assert.equal(sanitizeBodyHtml('<blockquote data-x-post="123" onclick="bad()"><script>bad()</script>نص</blockquote>'), '<blockquote data-x-post="123">نص</blockquote>');
  assert.match(sanitizeBodyHtml('<blockquote><p>اقتباس عادي</p></blockquote>'), /^<blockquote><p>اقتباس عادي/);
});
