/**
 * حارس السياسة التحريرية لمشروع العلم — M4-T6.
 *
 * المصدر الملزم: docs/editorial-policy.md المشتق من
 * «الآلية العامة وسياسة التحرير لمشروع العلم» (TREND، مايو 2023).
 *
 * القواعد هنا حتمية بالكامل: قواميس وأنماط وعدّ — بلا نموذج لغوي.
 * القواعد التي تحتاج حكمًا سياقيًا تُعلَّم بـ needsHumanReview لتصل إلى المعتمد البشري
 * بدل أن تمر صامتة، ويأتي التقييم النموذجي لها في M4-T7/M4-T8.
 */

export { runPolicyGuard, applyAutofixes, guardWithAutofix } from "./engine.ts";
export { runConfiguredPolicyGuard, type GuardControls } from "./configured.ts";
export { allRules } from "./rules/index.ts";
export * from "./types.ts";
export { normalizeArabic, countWords, toLatinDigits } from "./normalize.ts";
