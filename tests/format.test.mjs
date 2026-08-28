import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formatArticleDek, formatReadingBrief, toLatinDigits } from "../lib/format.ts";

test("صفحة المادة تفصل الموجز عن العنوان بوحدة «قبل القراءة»", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/[section]/[id]/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /className="article-brief"/);
  assert.match(page, /قبل القراءة/);
  assert.match(page, /article-brief-label/);
  assert.doesNotMatch(page, /className="article-deck"/);
  assert.match(css, /\.article-brief\s*\{/);
  assert.match(css, /border-inline-start:\s*3px solid var\(--gold\)/);
});

test("موجز المادة يُنظَّف من حشو ووردبريس دون قصّ الجملة", () => {
  const messy = "  جملة عن الطاقة المتجددة في المملكة…  ";
  assert.equal(formatArticleDek(messy), "جملة عن الطاقة المتجددة في المملكة");
  assert.equal(toLatinDigits("١٢"), "12");
});

test("قبل القراءة يبقى جملة خلاصة لا لصق أول المتن", () => {
  const excerpt =
    "أكد مجلس الشيوخ الأمريكي اختيار تود بلانش محاميًا عامًا في تصويت جرى في وقت مبكر من صباح السبت بنتيجة 50 مقابل 49 صوتًا. ويُكرس هذا القرار هيمنة المحامي الشخصي السابق للرئيس دونالد ترامب على قيادة وزارة العدل رسميًا. تود بلانش محامي عام وانضم السناتوران لمعارضة الترشيح،…";
  const brief = formatReadingBrief(excerpt);
  assert.ok(brief.startsWith("أكد مجلس الشيوخ"));
  assert.ok(!brief.includes("ويُكرس هذا القرار"));
  assert.ok(brief.split(/\s+/).length <= 25);
  assert.ok(brief.length <= 180);
});
