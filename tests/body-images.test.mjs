import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { sanitizeBodyHtml, stripHtmlToText } from "../lib/content/html.ts";
import { responsiveBodyImages } from "../lib/content/body-images.ts";
import { htmlToBlocks } from "../lib/mobile/blocks.ts";
import { applyTextPreservingFormatting, formattingLoss } from "../lib/tahrir/editor/preserve-formatting.ts";

const SRC = "/uploads/0b1c2d3e-1234-4abc-8def-0123456789ab.png";
const FIGURE = `<figure><img src="${SRC}" alt="المصدر: الهيئة" width="1080" height="3000" loading="lazy" decoding="async"><figcaption>المصدر: الهيئة</figcaption></figure>`;

test("صورة المكتبة داخل المتن تمر بسمات مُعاد بناؤها وثابتة عند إعادة التنقية", () => {
  const dirty = `<p>قبل</p><figure class="x"><img src="${SRC}" alt="المصدر: الهيئة" width="1080" height="3000" onerror="x()"><figcaption>المصدر: الهيئة</figcaption></figure><p>بعد</p>`;
  const clean = sanitizeBodyHtml(dirty);
  assert.equal(clean, `<p>قبل</p>${FIGURE}<p>بعد</p>`);
  assert.equal(sanitizeBodyHtml(clean), clean);
  assert.equal(stripHtmlToText(clean), "قبل\n\nالمصدر: الهيئة\n\nبعد");
});

test("الصور من خارج المكتبة تسقط والإطار الفارغ يصير فقرة تعليق", () => {
  assert.equal(sanitizeBodyHtml('<figure><img src="https://evil.test/x.png"><figcaption>تعليق</figcaption></figure>'), "<p>تعليق</p>");
  assert.equal(sanitizeBodyHtml('<p>نص</p><img src="data:image/png;base64,AAAA"><img src="/uploads/../x.png">'), "<p>نص</p>");
  const alt = sanitizeBodyHtml(`<img src="${SRC}" alt='"><script>x</script>'>`);
  assert.ok(!alt.includes("<script"));
  assert.match(alt, /alt="&quot;&gt;"/);
});

test("صفحة المادة تطلب مقاسات مُصغّرة وتربط الأصل للتكبير", () => {
  const html = responsiveBodyImages(FIGURE);
  assert.match(html, /<a class="article-figure-link" href="\/uploads\/[^"]+\.png" target="_blank"/);
  assert.match(html, /src="\/image-variants\?src=%2Fuploads%2F[^"]+&amp;w=1080&amp;v=1"/);
  assert.match(html, /srcset="[^"]+ 640w, [^"]+ 1080w, [^"]+ 1600w"/);
  assert.match(html, /width="1080" height="3000"/);
  assert.ok(!html.includes("aria-label"));
  assert.match(responsiveBodyImages(`<img src="${SRC}" alt="">`), /aria-label="فتح الصورة بدقتها الكاملة"/);
});

test("عقد الجوال يحمل الصورة كتلة مستقلة بتعليقها في موضعها", () => {
  const blocks = htmlToBlocks(`<p>قبل</p>${FIGURE}<p>بعد</p>`);
  assert.deepEqual(blocks, [
    { type: "paragraph", runs: [{ text: "قبل" }] },
    { type: "image", src: SRC, alt: "المصدر: الهيئة", width: 1080, height: 3000, caption: "المصدر: الهيئة" },
    { type: "paragraph", runs: [{ text: "بعد" }] },
  ]);
});

test("التحرير الشامل بالذكاء لا يفقد صور المتن", () => {
  const html = `<p>فقرة أولى</p>${FIGURE}<p>فقرة ثانية</p>`;
  const next = applyTextPreservingFormatting(html, "فقرة معدلة\n\nفقرة ثانية");
  assert.ok(next.includes(FIGURE));
  const loss = formattingLoss(html, "فقرة معدلة");
  assert.equal(loss.images, 1);
  assert.equal(loss.none, false);
});

test("محرر المتن يرفع الصورة عبر المكتبة ويدرجها في موضع المؤشر", async () => {
  const body = await readFile(new URL("../components/tahrir/editor/rich-body.tsx", import.meta.url), "utf8");
  assert.match(body, /await uploadStoryImageFile\(file,/);
  assert.match(body, /insertContentAt\(pos, \{\s*type: "bodyImage"/);
  assert.match(body, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(body, /إدراج صورة/);
});
