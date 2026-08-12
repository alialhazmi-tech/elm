import assert from "node:assert/strict";
import test from "node:test";

import { formatArticleDek, toLatinDigits } from "../lib/format.ts";

test("موجز المادة يُقصّ ويُنظَّف بلا حشو ووردبريس", () => {
  const long =
    "أكد مجلس الشيوخ الأمريكي اختيار تود بلانش محاميًا عامًا في تصويت جرى في وقت مبكر من صباح السبت بنتيجة 50 مقابل 49 صوتًا. ويُكرس هذا القرار هيمنة المحامي الشخصي السابق للرئيس دونالد ترامب على قيادة وزارة العدل رسميًا. تود بلانش محامي عام…";
  const dek = formatArticleDek(long);
  assert.ok(dek.length < long.length);
  assert.ok(dek.endsWith("…"));
  assert.equal(formatArticleDek("جملة قصيرة عن الطاقة"), "جملة قصيرة عن الطاقة.");
  assert.equal(toLatinDigits("١٢"), "12");
});
