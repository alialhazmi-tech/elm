import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeBodyHtml, stripHtmlToText } from "../lib/content/html.ts";
import {
  applyTextPreservingFormatting,
  findTextRange,
  formattingInventory,
  formattingLoss,
  formattingLossLabel,
} from "../lib/tahrir/editor/preserve-formatting.ts";

const POST = '<blockquote data-x-post="1293593516040269825"><a href="https://x.com/i/status/1293593516040269825" target="_blank" rel="noopener noreferrer">عرض التغريدة على X</a></blockquote>';
const HTML =
  '<p>أعلنت <a href="https://www.spa.gov.sa/w1" target="_blank" rel="noopener noreferrer">وكالة الأنباء السعودية</a> عن البرنامج الجديد.</p>' +
  "<h2>تفاصيل البرنامج</h2>" +
  "<ul><li><p>أول بند</p></li><li><p>ثاني بند</p></li></ul>" +
  POST +
  '<p>راجع <a href="/series/absat">سلسلة أبسط</a> للمزيد.</p>';

test("الجرد يعدّ الروابط والعناوين والقوائم والتغريدات دون احتساب رابط التغريدة نفسه", () => {
  const inventory = formattingInventory(HTML);
  assert.deepEqual(inventory.links, [
    { href: "https://www.spa.gov.sa/w1", text: "وكالة الأنباء السعودية" },
    { href: "/series/absat", text: "سلسلة أبسط" },
  ]);
  assert.deepEqual(inventory.headings, [{ level: 2, text: "تفاصيل البرنامج" }]);
  assert.equal(inventory.lists, 1);
  assert.deepEqual(inventory.xPosts, ["1293593516040269825"]);
});

test("التطبيق يعيد الروابط على أول ظهور حرفي ويعيد التغريدات في النهاية ويستعيد العنوان المطابق", () => {
  const proposal = "أعلنت وكالة الأنباء السعودية عن البرنامج الجديد بصيغة محررة.\n\nتفاصيل البرنامج\n\nأول بند وثاني بند في فقرة واحدة.\n\nراجع سلسلة أبسط للمزيد.";
  const html = applyTextPreservingFormatting(HTML, proposal);
  const clean = sanitizeBodyHtml(html);
  assert.equal(
    clean,
    '<p>أعلنت <a href="https://www.spa.gov.sa/w1" target="_blank" rel="noopener noreferrer">وكالة الأنباء السعودية</a> عن البرنامج الجديد بصيغة محررة.</p>' +
      "<h2>تفاصيل البرنامج</h2>" +
      "<p>أول بند وثاني بند في فقرة واحدة.</p>" +
      '<p>راجع <a href="/series/absat">سلسلة أبسط</a> للمزيد.</p>' +
      POST,
  );
  assert.equal(stripHtmlToText(clean).includes("<"), false);
});

test("الروابط التي غاب نصها تُحتسب مفقودة والقوائم مفقودة دائمًا والتغريدات محفوظة", () => {
  const proposal = "أعلنت الوكالة الرسمية عن البرنامج.\n\nنقاط أخرى.";
  const loss = formattingLoss(HTML, proposal);
  assert.deepEqual(loss.links, { total: 2, preserved: 0, lost: 2 });
  assert.deepEqual(loss.headings, { total: 1, preserved: 0, lost: 1 });
  assert.equal(loss.lists, 1);
  assert.deepEqual(loss.xPosts, { total: 1, preserved: 1 });
  assert.equal(loss.none, false);
  const label = formattingLossLabel(loss);
  assert.match(label, /2 من 2 روابط تُفقد/);
  assert.match(label, /عناوين فرعية تُفقد/);
  assert.match(label, /قوائم تتحول/);
  assert.match(label, /تغريدات تُعاد/);
});

test("متن بلا تنسيق لا يطلق أي تنبيه والنص يُهرَّب ويقسم فقرات وأسطر", () => {
  const loss = formattingLoss("<p>فقرة عادية</p>", "نص جديد");
  assert.equal(loss.none, true);
  assert.equal(formattingLossLabel(loss), "");
  assert.equal(applyTextPreservingFormatting("<p>قديم</p>", "أ < ب\nج\n\nد & هـ"), "<p>أ &lt; ب<br>ج</p><p>د &amp; هـ</p>");
});

test("رابط واحد لا يُطبَّق مرتين ولا يتداخل مع رابط آخر في المقطع نفسه", () => {
  const html = '<p><a href="https://a.example">واس</a> و<a href="https://b.example">واس</a></p>';
  const out = applyTextPreservingFormatting(html, "قالت واس إن واس مصدر.");
  assert.equal(out, '<p>قالت <a href="https://a.example">واس</a> إن <a href="https://b.example">واس</a> مصدر.</p>');
});

test("البحث عبر عقد النص المتجاورة يعثر على المدى عبر العلامات ولا يعبر حدود الكتل", () => {
  // <p>أب<strong>جد</strong></p><p>هو</p> → مواضع: 1 "أب", 3 "جد", 7 "هو"
  const runs = [
    { pos: 1, text: "أب" },
    { pos: 3, text: "جد" },
    { pos: 7, text: "هو" },
  ];
  assert.deepEqual(findTextRange(runs, "بج"), { from: 2, to: 4 });
  assert.deepEqual(findTextRange(runs, "هو"), { from: 7, to: 9 });
  assert.equal(findTextRange(runs, "دهو"), null);
  assert.equal(findTextRange(runs, ""), null);
  assert.equal(findTextRange([], "أ"), null);
});
