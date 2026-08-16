import assert from "node:assert/strict";
import test from "node:test";

import { extractNumbersFromText, generateInfographicPlan, getBlueEconomyPreset } from "../lib/ai/infographic.ts";
import { INFOGRAPHIC_THEMES, THEME_CONFIGS } from "../lib/ai/infographic-types.ts";

test("استخراج الأرقام من النصوص يطابق الأرقام اللاتينية والهندية", () => {
  const text = "سجل الإنتاج 289.9 ألف طن و١٩٢.٤ مزارع و٩٧.٦ شبكات في عام 2024 بمعدل 19%.";
  const numbers = extractNumbersFromText(text);
  assert.ok(numbers.includes("289.9"));
  assert.ok(numbers.includes("192.4"));
  assert.ok(numbers.includes("97.6"));
  assert.ok(numbers.includes("2024"));
  assert.ok(numbers.includes("19"));
});

test("السمات اللونية المعتمدة مهيأة بجميع متغيرات التوهج والخلفيات", () => {
  assert.equal(INFOGRAPHIC_THEMES.length, 6);
  for (const themeId of INFOGRAPHIC_THEMES) {
    const config = THEME_CONFIGS[themeId];
    assert.ok(config);
    assert.ok(config.bgGradient.includes("linear-gradient"));
    assert.ok(config.cardBg);
    assert.ok(config.accentColor);
  }
});

test("نموذج اقتصاد المدّ الأزرق الافتراضي يحمل جميع الأقسام والمؤشرات", () => {
  const preset = getBlueEconomyPreset();
  assert.equal(preset.themeId, "ocean-cyber");
  assert.equal(preset.title, "اقتصاد المدّ الأزرق");
  assert.ok(preset.macroSection.stats.length >= 3);
  assert.ok(preset.showcaseSection.items.length >= 4);
  assert.ok(preset.operationsSection.blocks.length >= 4);
  assert.ok(preset.visionSection.targets.length >= 2);
});

test("توليد الإنفوجرافيك يعيد خطة متكاملة محكومة بالسمة والموضوع", async () => {
  const result = await generateInfographicPlan({
    topic: "مبادرة السعودية الخضراء",
    text: "زراعة 10 مليارات شجرة لخفض الانبعاثات وتحقيق الاستدامة.",
    preferredTheme: "cyber-emerald",
  });

  assert.ok(result.infographic);
  assert.equal(result.infographic.themeId, "cyber-emerald");
  assert.ok(result.infographic.title);
  assert.ok(result.infographic.macroSection);
  assert.ok(result.infographic.showcaseSection);
});

test("تحويل نص تقرير تعديني خام إلى عنوان عريض ومؤشرات وأقسام متكاملة", async () => {
  const rawMiningText = `
    أعلنت وزارة الصناعة والثروة المعدنية أن الثروة المعدنية غير المستغلة في المملكة تقدر بنحو 9.4 تريليون ريال (2.5 تريليون دولار)، بزيادة 90% عن التقديرات السابقة البالغة 5 تريليونات ريال.
    تشمل الثروات الذهب والفوسفات والنحاس والزنك والعناصر الأرضية النادرة.
    تم إصدار أكثر من 2300 رخصة تعدينية، وتهدف الاستراتيجية إلى زيادة مساهمة القطاع في الناتج المحلي الإجمالي إلى أكثر من 280 مليار ريال بحلول 2030 وتوليد أكثر من 200 ألف وظيفة مباشرة.
  `;

  const result = await generateInfographicPlan({
    topic: "الثروة المعدنية السعودية",
    text: rawMiningText,
    preferredTheme: "desert-gold",
  });

  assert.ok(result.infographic);
  assert.equal(result.infographic.themeId, "desert-gold");
  assert.ok(result.infographic.title.length > 0);
  assert.ok(result.infographic.macroSection.stats.length >= 3);
  assert.ok(result.infographic.showcaseSection.items.length >= 3);
  assert.ok(result.infographic.visionSection.targets.length >= 1);
});
