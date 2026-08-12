import assert from "node:assert/strict";
import test from "node:test";

import { formatArticleDek, toLatinDigits } from "../lib/format.ts";

test("موجز المادة يُنظَّف من حشو ووردبريس دون قصّ الجملة", () => {
  const messy = "  جملة عن الطاقة المتجددة في المملكة…  ";
  assert.equal(formatArticleDek(messy), "جملة عن الطاقة المتجددة في المملكة");
  assert.equal(toLatinDigits("١٢"), "12");
});
