/** بند 4: محاذير الموضوعات. */

import type { Rule } from "../types.ts";
import { hostOf, normalizeArabic } from "../normalize.ts";
import { ISRAEL_TERMS, NATIONALIST_OCCASIONS } from "../dictionary.ts";
import { collectProse, makeFinding, phraseRule, wholeText } from "./shared.ts";

const WAS_HOST = "spa.gov.sa";

const israelCoverage: Rule = {
  id: "RESTRICTED-ISRAEL",
  category: "restricted",
  severity: "blocking",
  policyRef: "الدستور التحريري § 4",
  title: "عدم التطرق لإسرائيل إلا بما تذكره واس",
  run(draft) {
    const terms = ISRAEL_TERMS.map(normalizeArabic);
    const mentions = collectProse(draft).filter((entry) => {
      const value = normalizeArabic(entry.value);
      return terms.some((term) => value.includes(term));
    });
    if (mentions.length === 0) return [];

    const citesWas = (draft.sourceUrls ?? []).some((url) => {
      const host = hostOf(url);
      return host === WAS_HOST || (host?.endsWith(`.${WAS_HOST}`) ?? false);
    });

    return mentions.map((entry) => {
      const finding = makeFinding(israelCoverage, {
        field: entry.field,
        message: citesWas
          ? "الطرح مستند إلى واس. التزم بما ورد فيها حرفيًا — إسرائيل غير معترف بها دولة وفق سياسة المملكة — ويلزم اعتماد مدير التحرير."
          : "لا يُتطرق لإسرائيل لأي سبب إلا بما يُذكر في وكالة الأنباء السعودية (واس). أضف مصدر واس أو احذف الإشارة.",
        needsHumanReview: citesWas,
      });

      return citesWas ? { ...finding, severity: "warning" as const } : finding;
    });
  },
};

const nationalistOccasions = phraseRule(
  {
    id: "RESTRICTED-OCCASIONS",
    category: "restricted",
    severity: "warning",
    policyRef: "الدستور التحريري § 4",
    title: "المناسبات الثورية والقومية",
  },
  NATIONALIST_OCCASIONS,
  (phrase) =>
    `«${phrase}» من المناسبات الثورية والقومية المحظورة إلا ما يتصل بالمملكة أو بإحدى الدول شديدة القرب. يلزم قرار مدير التحرير قبل الاعتماد.`,
);

const offenceReview: Rule = {
  id: "RESTRICTED-OFFENCE",
  category: "restricted",
  severity: "warning",
  policyRef: "الدستور التحريري § 4",
  title: "الإساءة للمملكة أو الدول الصديقة",
  run(draft) {
    const text = wholeText(draft);
    const triggers = ["اساءه", "انتقاد حاد", "هجوم على المملكه", "تشكيك"].map(normalizeArabic);
    if (!triggers.some((trigger) => text.includes(trigger))) return [];

    return [
      makeFinding(offenceReview, {
        field: "body",
        message:
          "المادة تحمل ألفاظًا قد تُقرأ كإساءة للمملكة أو حكومتها أو للدول الصديقة والحليفة. تلزم مراجعة مدير التحرير قبل الاعتماد.",
        needsHumanReview: true,
      }),
    ];
  },
};

export const restrictedRules: Rule[] = [israelCoverage, nationalistOccasions, offenceReview];
