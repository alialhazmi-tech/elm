import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formatArticleDek, toLatinDigits } from "../lib/format.ts";

test("صفحة المادة تعرض الملخص الكامل تحت العنوان دون صندوق مكرر", async () => {
  const page = await readFile(new URL("../app/[section]/[id]/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const fullExcerpt = formatArticleDek\(story.excerpt\)/);
  assert.match(page, /className="sa-dek">\{fullExcerpt\}/);
  assert.doesNotMatch(page, /formatReadingBrief|className="article-brief"/);
});

test("موجز المادة يُنظَّف من حشو ووردبريس دون قصّ الجملة", () => {
  const messy = "  جملة عن الطاقة المتجددة في المملكة…  ";
  assert.equal(formatArticleDek(messy), "جملة عن الطاقة المتجددة في المملكة");
  assert.equal(toLatinDigits("١٢"), "12");
});

test("ملخص أقل من 180 حرفًا يحتفظ بما بعد الكلمة الخامسة والعشرين", () => {
  const excerpt = "أدان وزراء خارجية 8 دول بينها المملكة تصريحات وزيرين إسرائيليين بشأن تهجير الفلسطينيين من غزة كونه انتهاكًا صارخًا، ودعوا مجلس الأمن إلى التصدي لأي فرض للتهجير";
  assert.ok(excerpt.length < 180);
  assert.ok(excerpt.split(/\s+/).length > 25);
  assert.equal(formatArticleDek(excerpt), excerpt);
});

test("الملخص المحفوظ يحافظ على جمله كاملة ولو تجاوز الحدود القديمة", () => {
  const excerpt =
    "أكد مجلس الشيوخ الأمريكي اختيار تود بلانش محاميًا عامًا في تصويت جرى في وقت مبكر من صباح السبت بنتيجة 50 مقابل 49 صوتًا. ويُكرس هذا القرار هيمنة المحامي الشخصي السابق للرئيس دونالد ترامب على قيادة وزارة العدل رسميًا. تود بلانش محامي عام وانضم السناتوران لمعارضة الترشيح،…";
  assert.equal(formatArticleDek(excerpt), excerpt.slice(0, -1));
  assert.equal(formatArticleDek("  \n  "), "");
});
