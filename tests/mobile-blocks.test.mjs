import assert from "node:assert/strict";
import test from "node:test";

import { bodyToBlocks, decodeEntities, htmlToBlocks, plainTextToBlocks } from "../lib/mobile/blocks.ts";

test("فقرة بسيطة تصبح مقطعًا واحدًا بلا HTML", () => {
  assert.deepEqual(htmlToBlocks("<p>نص عادي</p>"), [{ type: "paragraph", runs: [{ text: "نص عادي" }] }]);
});

test("العلامات المتداخلة تُفكّ إلى مقاطع متجاورة بعلامات منطقية", () => {
  const blocks = htmlToBlocks("<p>قبل <strong>غامق <em>غامق ومائل</em> غامق</strong> بعد <u>تحته</u> و<s>مشطوب</s></p>");
  assert.deepEqual(blocks, [
    {
      type: "paragraph",
      runs: [
        { text: "قبل " },
        { text: "غامق ", bold: true },
        { text: "غامق ومائل", bold: true, italic: true },
        { text: " غامق", bold: true },
        { text: " بعد " },
        { text: "تحته", underline: true },
        { text: " و" },
        { text: "مشطوب", strike: true },
      ],
    },
  ]);
});

test("الأسماء البديلة b/i تُعامل كغامق ومائل والمقاطع المتماثلة تُدمج", () => {
  assert.deepEqual(htmlToBlocks("<p><b>أ</b><strong>ب</strong> <i>ج</i></p>"), [
    { type: "paragraph", runs: [{ text: "أب", bold: true }, { text: " " }, { text: "ج", italic: true }] },
  ]);
});

test("الروابط تحمل href مفكوك الكيانات وتتداخل مع العلامات", () => {
  const blocks = htmlToBlocks('<p>انظر <a href="https://example.org/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">المصدر <strong>الرسمي</strong></a>.</p>');
  assert.deepEqual(blocks, [
    {
      type: "paragraph",
      runs: [
        { text: "انظر " },
        { text: "المصدر ", href: "https://example.org/?a=1&b=2" },
        { text: "الرسمي", bold: true, href: "https://example.org/?a=1&b=2" },
        { text: "." },
      ],
    },
  ]);
  // رابط بلا href صالح يبقى نصًا عاديًا.
  assert.deepEqual(htmlToBlocks('<p><a href="javascript:alert(1)">نص</a></p>'), [{ type: "paragraph", runs: [{ text: "نص" }] }]);
});

test("<br> داخل الفقرة يصبح سطرًا جديدًا بلا فراغات حوله", () => {
  assert.deepEqual(htmlToBlocks("<p>سطر أول  <br>\n  سطر ثانٍ<br/>سطر ثالث</p>"), [
    { type: "paragraph", runs: [{ text: "سطر أول\nسطر ثانٍ\nسطر ثالث" }] },
  ]);
  // فاصل في بداية الفقرة أو نهايتها لا يترك أثرًا.
  assert.deepEqual(htmlToBlocks("<p><br>نص<br></p>"), [{ type: "paragraph", runs: [{ text: "نص" }] }]);
});

test("الكيانات المسماة والرقمية تُفكّ في النص", () => {
  assert.equal(decodeEntities("&amp; &lt; &gt; &quot; &#39; &#x27; &nbsp; &#8230; &hellip;"), "& < > \" ' '   … …");
  assert.equal(decodeEntities("&unknown; &#xZZ;"), "&unknown; &#xZZ;");
  assert.deepEqual(htmlToBlocks("<p>A &amp; B&nbsp;C&#8230;&#x27;D&#x27;</p>"), [
    { type: "paragraph", runs: [{ text: "A & B C…'D'" }] },
  ]);
  // «&lt;p&gt;» نص لا وسم.
  assert.deepEqual(htmlToBlocks("<p>&lt;p&gt;ليس وسمًا&lt;/p&gt;</p>"), [{ type: "paragraph", runs: [{ text: "<p>ليس وسمًا</p>" }] }]);
});

test("القوائم المرتبة وغير المرتبة تحتفظ بعلامات عناصرها وفقرات Tiptap داخل العنصر", () => {
  const html = "<ul><li><p>أول <strong>مهم</strong></p></li><li><p>ثانٍ</p><p>سطر آخر</p></li></ul><ol><li>واحد</li><li><em>اثنان</em></li></ol>";
  assert.deepEqual(htmlToBlocks(html), [
    { type: "list", ordered: false, items: [[{ text: "أول " }, { text: "مهم", bold: true }], [{ text: "ثانٍ\nسطر آخر" }]] },
    { type: "list", ordered: true, items: [[{ text: "واحد" }], [{ text: "اثنان", italic: true }]] },
  ]);
});

test("القائمة المتداخلة تُدمج في القائمة الأم والعناصر الفارغة تُسقط", () => {
  assert.deepEqual(htmlToBlocks("<ul><li>أ<ul><li>أ-1</li><li> </li></ul></li><li>ب</li></ul>"), [
    { type: "list", ordered: false, items: [[{ text: "أ" }], [{ text: "أ-1" }], [{ text: "ب" }]] },
  ]);
  assert.deepEqual(htmlToBlocks("<ul><li></li></ul>"), []);
});

test("العناوين h2/h3 بمستواها والاقتباس بمقاطعه", () => {
  assert.deepEqual(htmlToBlocks("<h2>عنوان <em>فرعي</em></h2><h3>أصغر</h3><blockquote>قال <strong>أحدهم</strong></blockquote>"), [
    { type: "heading", level: 2, runs: [{ text: "عنوان " }, { text: "فرعي", italic: true }] },
    { type: "heading", level: 3, runs: [{ text: "أصغر" }] },
    { type: "quote", runs: [{ text: "قال " }, { text: "أحدهم", bold: true }] },
  ]);
});

test("تغريدة X المضمّنة تصبح كتلة xpost بمعرّف المنشور", () => {
  const html = '<blockquote data-x-post="1830000000000000001"><a href="https://x.com/i/status/1830000000000000001">تغريدة</a></blockquote>';
  assert.deepEqual(htmlToBlocks(html), [
    { type: "xpost", postId: "1830000000000000001", runs: [{ text: "تغريدة", href: "https://x.com/i/status/1830000000000000001" }] },
  ]);
  // بلا نص داخلها تبقى الكتلة لأن المعرّف هو المحتوى.
  assert.deepEqual(htmlToBlocks('<blockquote data-x-post="42"></blockquote>'), [{ type: "xpost", postId: "42", runs: [] }]);
});

test("المحاذاة تُمرَّر على الفقرات والعناوين والاقتباسات فقط عند وجودها", () => {
  assert.deepEqual(htmlToBlocks('<p style="text-align:center">وسط</p><h2 style="text-align: LEFT">يسار</h2><blockquote style="text-align:justify">ضبط</blockquote><p>افتراضي</p>'), [
    { type: "paragraph", runs: [{ text: "وسط" }], align: "center" },
    { type: "heading", level: 2, runs: [{ text: "يسار" }], align: "left" },
    { type: "quote", runs: [{ text: "ضبط" }], align: "justify" },
    { type: "paragraph", runs: [{ text: "افتراضي" }] },
  ]);
  assert.ok(!("align" in htmlToBlocks("<p>بلا</p>")[0]));
});

test("الفقرات والعناوين الفارغة تُسقط والفراغ بين الكتل يُتجاهل", () => {
  assert.deepEqual(htmlToBlocks("<p></p>\n<p> &nbsp; </p><p><br></p><h2></h2>\n  <p>باقٍ</p>\n"), [
    { type: "paragraph", runs: [{ text: "باقٍ" }] },
  ]);
  assert.deepEqual(htmlToBlocks(""), []);
});

test("الوسوم غير المعروفة تُسقط ويبقى نصها والنص الطليق يصبح فقرة", () => {
  assert.deepEqual(htmlToBlocks("نص طليق <span>داخل span</span><p>فقرة</p><div>قسم</div>"), [
    { type: "paragraph", runs: [{ text: "نص طليق داخل span" }] },
    { type: "paragraph", runs: [{ text: "فقرة" }] },
    { type: "paragraph", runs: [{ text: "قسم" }] },
  ]);
});

test("الفراغ داخل الفقرة يُطوى إلى مسافة واحدة ويُقصّ من الطرفين", () => {
  assert.deepEqual(htmlToBlocks("<p>\n   كلمة   \n\t أخرى   </p>"), [{ type: "paragraph", runs: [{ text: "كلمة أخرى" }] }]);
});

test("العلامة غير المغلقة لا تكسر التحويل", () => {
  assert.deepEqual(htmlToBlocks("<p><strong>غامق</p><p>عادي</strong></p>"), [
    { type: "paragraph", runs: [{ text: "غامق", bold: true }] },
    { type: "paragraph", runs: [{ text: "عادي", bold: true }] },
  ]);
});

test("النص الإرثي بلا وسوم يصبح فقرات من سطرين فأكثر", () => {
  const legacy = "الفقرة الأولى\nتكملة السطر\n\n\nالفقرة الثانية  \n\n   \n";
  assert.deepEqual(plainTextToBlocks(legacy), [
    { type: "paragraph", runs: [{ text: "الفقرة الأولى\nتكملة السطر" }] },
    { type: "paragraph", runs: [{ text: "الفقرة الثانية" }] },
  ]);
  assert.deepEqual(bodyToBlocks(legacy), plainTextToBlocks(legacy));
  assert.deepEqual(bodyToBlocks("<p>HTML</p>"), [{ type: "paragraph", runs: [{ text: "HTML" }] }]);
  // نص إرثي يحوي «&amp;» حرفيًا يبقى كما هو — لا تفكيك كيانات بلا وسوم.
  assert.deepEqual(bodyToBlocks("A &amp; B"), [{ type: "paragraph", runs: [{ text: "A &amp; B" }] }]);
});

test("مادة كاملة من المحرر تُحوَّل بترتيبها", () => {
  const html = [
    "<p>مقدمة <strong>قوية</strong>.</p>",
    "<h2>المحور الأول</h2>",
    "<p>تفصيل<br>سطر ثانٍ</p>",
    "<ul><li><p>نقطة</p></li></ul>",
    "<blockquote>اقتباس</blockquote>",
    '<blockquote data-x-post="7"><a href="https://x.com/i/status/7">https://x.com/i/status/7</a></blockquote>',
    "<p></p>",
  ].join("");
  assert.deepEqual(htmlToBlocks(html).map((block) => block.type), ["paragraph", "heading", "paragraph", "list", "quote", "xpost"]);
});
