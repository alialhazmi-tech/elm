/** بند 7: قواعد الكتابة والتنسيق — أغلبها قابل للإصلاح الآلي. */

import type { Rule } from "../types.ts";
import { findPhrases, toLatinDigits } from "../normalize.ts";
import { PLATFORM_NAMES, UNIT_ABBREVIATIONS } from "../dictionary.ts";
import { abbreviationRule, collectProse, makeFinding } from "./shared.ts";

const YEAR_MARKER = /(1[3-5]\d{2}|19\d{2}|20\d{2})\s*(هـ|م)(?!\p{L})/gu;
const NUMERIC_DATE = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g;
const CLOCK_SUFFIX = /\d{1,2}:\d{2}\s*(AM|PM|صباحًا|صباحا|مساءً|مساء)/giu;
const CURRENCY_TERMS = ["ريال سعودي", "ريالًا سعوديًا", "SAR"] as const;

const ARABIC_INDIC_RUN = /[\u0660-\u0669\u06F0-\u06F9]+/g;

/**
 * قرار المنتج المعتمد: الأرقام اللاتينية 0–9 في جميع الحقول التحريرية.
 * الحقول التقنية مثل الروابط والسكربتات ليست ضمن collectProse.
 */
const latinDigits: Rule = {
  id: "FORMAT-LATIN-DIGITS",
  category: "formatting",
  severity: "suggestion",
  policyRef: "دليل الهوية V1.0 — قرار المنتج المعتمد",
  title: "الأرقام اللاتينية في المحتوى",
  run(draft) {
    return collectProse(draft)
      .flatMap((entry) => {
        ARABIC_INDIC_RUN.lastIndex = 0;
        return [...entry.value.matchAll(ARABIC_INDIC_RUN)].map((match) => {
          const latin = toLatinDigits(match[0]);
          return makeFinding(latinDigits, {
            field: entry.field,
            message: `استبدل «${match[0]}» بالأرقام اللاتينية «${latin}».`,
            excerpt: match[0],
            index: match.index,
            autofix: { field: entry.field, from: match[0], to: latin },
          });
        });
      });
  },
};

const dateMarker: Rule = {
  id: "FORMAT-DATE-MARKER",
  category: "formatting",
  severity: "suggestion",
  policyRef: "الدستور التحريري § 7",
  title: "حذف (هـ) و(م) من التواريخ",
  run(draft) {
    return collectProse(draft).flatMap((entry) => {
      YEAR_MARKER.lastIndex = 0;
      return [...entry.value.matchAll(YEAR_MARKER)].map((match) =>
        makeFinding(dateMarker, {
          field: entry.field,
          message: `لا نستخدم (${match[2]}) للإشارة إلى نوع التاريخ. اكتب «${match[1]}» مجردة.`,
          excerpt: match[0],
          index: match.index,
          autofix: { field: entry.field, from: match[0], to: match[1] },
        }),
      );
    });
  },
};

const dateShape: Rule = {
  id: "FORMAT-DATE-SHAPE",
  category: "formatting",
  severity: "suggestion",
  policyRef: "الدستور التحريري § 7",
  title: "الشهر بالحروف واليوم والعام بالأرقام",
  run(draft) {
    return collectProse(draft).flatMap((entry) => {
      NUMERIC_DATE.lastIndex = 0;
      return [...entry.value.matchAll(NUMERIC_DATE)].map((match) =>
        makeFinding(dateShape, {
          field: entry.field,
          message: `اكتب التاريخ «${match[0]}» بالصيغة المعتمدة: الشهر بالحروف واليوم والعام بالأرقام، مثل «29 مارس 2023».`,
          excerpt: match[0],
          index: match.index,
        }),
      );
    });
  },
};

const timeShape: Rule = {
  id: "FORMAT-TIME-SHAPE",
  category: "formatting",
  severity: "suggestion",
  policyRef: "الدستور التحريري § 7",
  title: "صيغة الوقت المعتمدة",
  run(draft) {
    return collectProse(draft).flatMap((entry) => {
      CLOCK_SUFFIX.lastIndex = 0;
      return [...entry.value.matchAll(CLOCK_SUFFIX)].map((match) =>
        makeFinding(timeShape, {
          field: entry.field,
          message: "صيغة الوقت المعتمدة: (6:00 م) و(10:15 ص).",
          excerpt: match[0],
          index: match.index,
        }),
      );
    });
  },
};

const units = abbreviationRule(
  {
    id: "FORMAT-UNITS",
    category: "formatting",
    severity: "suggestion",
    policyRef: "الدستور التحريري § 7",
    title: "اختصار وحدات القياس",
  },
  UNIT_ABBREVIATIONS,
  (term, short) => `اختصر «${term}» إلى «${short}».`,
);

const platformNames: Rule = {
  id: "FORMAT-PLATFORM-LATIN",
  category: "formatting",
  severity: "suggestion",
  policyRef: "الدستور التحريري § 7",
  title: "أسماء المنصات بالإنجليزية",
  run(draft) {
    return collectProse(draft).flatMap((entry) =>
      PLATFORM_NAMES.filter(({ term }) => findPhrases(entry.value, [term]).length > 0).map(
        ({ term, latin }) =>
          makeFinding(platformNames, {
            field: entry.field,
            message: `تُكتب منصات التواصل بالإنجليزية: «${term}» ← «${latin}».`,
            excerpt: term,
            autofix: { field: entry.field, from: term, to: latin },
          }),
      ),
    );
  },
};

const currency: Rule = {
  id: "FORMAT-CURRENCY",
  category: "formatting",
  severity: "suggestion",
  policyRef: "الدستور التحريري § 7",
  title: "اختصار العملة",
  run(draft) {
    return collectProse(draft).flatMap((entry) =>
      CURRENCY_TERMS.filter((term) => findPhrases(entry.value, [term]).length > 0).map((term) =>
        makeFinding(currency, {
          field: entry.field,
          message: `عند الاختصار استخدم «ر.س» للريال السعودي و«$» للدولار بدل «${term}».`,
          excerpt: term,
        }),
      ),
    );
  },
};

const quoteColon: Rule = {
  id: "FORMAT-QUOTE-COLON",
  category: "formatting",
  severity: "warning",
  policyRef: "الدستور التحريري § 7",
  title: "الاقتباس يسبقه نقطتان ويوضع بين تنصيص",
  run(draft) {
    const openings = /[«"“]/g;

    return collectProse(draft).flatMap((entry) => {
      openings.lastIndex = 0;
      return [...entry.value.matchAll(openings)]
        .filter((match) => {
          const before = entry.value.slice(0, match.index).trimEnd();
          return before.length > 0 && !before.endsWith(":");
        })
        .slice(0, 1)
        .map((match) =>
          makeFinding(quoteColon, {
            field: entry.field,
            message: "النص المقتبس يجب أن تسبقه (:) ويوضع بين علامتي تنصيص، مثل: قال الرئيس التنفيذي: «...».",
            index: match.index,
          }),
        );
    });
  },
};

const entityHashtags: Rule = {
  id: "STATE-ENTITY-HASHTAG",
  category: "state",
  severity: "suggestion",
  policyRef: "الدستور التحريري § 2",
  title: "الجهات الحكومية في هاشتاق داخل النص المصاحب",
  run(draft) {
    const pattern = /(?<!#)وزار(?:ة|ه)\s+(\S+)/gu;

    return (draft.social ?? []).flatMap((caption, index) => {
      pattern.lastIndex = 0;
      return [...caption.text.matchAll(pattern)].map((match) =>
        makeFinding(entityHashtags, {
          field: `social[${index}].text`,
          message: `اكتب الجهة الحكومية في هاشتاق: «${match[0]}» ← «#وزارة_${match[1]}».`,
          excerpt: match[0],
          index: match.index,
          autofix: { field: `social[${index}].text`, from: match[0], to: `#وزارة_${match[1]}` },
        }),
      );
    });
  },
};

export const formattingRules: Rule[] = [
  latinDigits,
  dateMarker,
  dateShape,
  timeShape,
  units,
  platformNames,
  currency,
  quoteColon,
  entityHashtags,
];
