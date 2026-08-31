import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { headlineStat } from "../lib/content/headline-stat.ts";

test("النسبة تتصدر الاستخراج وتُعاد بأرقام لاتينية", () => {
  assert.equal(headlineStat("ارتفاع أسعار التنجستن بنسبة 622% منذ عام 2025"), "622%");
  assert.equal(headlineStat("ارتفاع سعة مشاريع الطاقة المتجددة بنسبة 88%"), "88%");
  assert.equal(headlineStat("نمو التجارة ٤٥٪ خلال العام"), "45%");
});

test("المقاييس تُختصر لاتينيًا كما في التصميم", () => {
  assert.equal(headlineStat("محطة الحناكية (1) تكفي لتزويد 190 ألف منزل بالكهرباء سنويًا"), "190K");
  assert.equal(headlineStat("استثمارات بقيمة 12 مليار ريال في القطاع"), "12B");
  assert.equal(headlineStat("بأطول شعر يبلغ 271.5 سنتيمتر تتوّج هندية في غينيس"), "271.5cm");
});

test("لا رقم مستنتج: العنوان بلا رقم واضح يعود بلا شيء", () => {
  assert.equal(headlineStat("من هو تود بلانش المدعي العام الجديد في إدارة ترامب؟"), null);
  assert.equal(headlineStat("من يستضيف مباراة نهائي كأس العالم 2030؟"), null);
  assert.equal(headlineStat("رئيس وزراء باكستان يزور المسجد النبوي"), null);
});

test("الكلمة الملتصقة لا تُقرأ وحدةَ قياس", () => {
  // «متر» جزء من «مترو» — فلا تُلتقط.
  assert.equal(headlineStat("افتتاح 4 مترو جديدة في الرياض"), null);
});

test("بطاقات صفحة السلسلة تعرض الرقم المفتاحي", async () => {
  const [seriesPage, card, css] = await Promise.all([
    readFile(new URL("../app/series/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/story-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/soft.css", import.meta.url), "utf8"),
  ]);
  assert.match(seriesPage, /headlineStat\(story\.title\)/);
  assert.match(card, /className="m-stat latin-number"/);
  assert.match(css, /\.m-stat\s*\{/);
});
