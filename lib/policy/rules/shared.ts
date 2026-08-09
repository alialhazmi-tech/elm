import type { Draft, Finding, Rule, RuleCategory, Severity } from "../types.ts";
import { findPhrasesNonOverlapping, normalizeArabic } from "../normalize.ts";

export interface ProseField {
  field: string;
  value: string;
}

/** كل الحقول النصية التي تسري عليها قواعد اللغة والبروتوكول. */
export function collectProse(draft: Draft): ProseField[] {
  const fields: ProseField[] = [];

  if (draft.title) fields.push({ field: "title", value: draft.title });
  if (draft.body) fields.push({ field: "body", value: draft.body });

  if (draft.infographic?.intro) {
    fields.push({ field: "infographic.intro", value: draft.infographic.intro });
  }
  draft.infographic?.points.forEach((point, index) => {
    fields.push({ field: `infographic.points[${index}]`, value: point });
  });

  if (draft.videographic?.intro) {
    fields.push({ field: "videographic.intro", value: draft.videographic.intro });
  }
  draft.videographic?.scenes.forEach((scene, index) => {
    fields.push({ field: `videographic.scenes[${index}]`, value: scene });
  });
  if (draft.videographic?.outro) {
    fields.push({ field: "videographic.outro", value: draft.videographic.outro });
  }

  draft.social?.forEach((caption, index) => {
    fields.push({ field: `social[${index}].text`, value: caption.text });
  });

  return fields;
}

/** النص المُطبَّع لكل المادة مجتمعة — للقواعد التي تفحص وجود الموضوع لا موضعه. */
export function wholeText(draft: Draft): string {
  return normalizeArabic(collectProse(draft).map((entry) => entry.value).join(" \n "));
}

/** تقسيم إلى جمل لتقليل الإيجابيات الكاذبة في القواعد التي تشترط التجاور. */
export function sentences(text: string): string[] {
  return normalizeArabic(text)
    .split(/[.!؟?\n]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export interface RuleSpec {
  id: string;
  category: RuleCategory;
  severity: Severity;
  policyRef: string;
  title: string;
}

export function makeFinding(
  spec: RuleSpec,
  detail: Omit<Finding, "ruleId" | "category" | "severity" | "policyRef">,
): Finding {
  return {
    ruleId: spec.id,
    category: spec.category,
    severity: spec.severity,
    policyRef: spec.policyRef,
    ...detail,
  };
}

/**
 * قاعدة اختصار: تطابق أطول مصطلح غير متداخل وتقترح بديله مع إصلاح آلي.
 * تُستخدم للألقاب العلمية ووحدات القياس حيث تحتوي المصطلحات بعضها بعضًا.
 */
export function abbreviationRule(
  spec: RuleSpec,
  entries: ReadonlyArray<{ term: string; short: string }>,
  message: (term: string, short: string) => string,
): Rule {
  const shortFor = new Map(entries.map((entry) => [normalizeArabic(entry.term), entry.short]));
  const terms = entries.map((entry) => entry.term);

  return {
    ...spec,
    run(draft) {
      return collectProse(draft).flatMap((entry) => {
        const reported = new Set<string>();

        return findPhrasesNonOverlapping(entry.value, terms).flatMap((match) => {
          const short = shortFor.get(normalizeArabic(match.phrase));
          if (!short || reported.has(match.phrase)) return [];
          reported.add(match.phrase);

          return [
            makeFinding(spec, {
              field: entry.field,
              message: message(match.phrase, short),
              excerpt: match.phrase,
              index: match.index,
              autofix: { field: entry.field, from: match.phrase, to: short },
            }),
          ];
        });
      });
    },
  };
}

/**
 * قاعدة قائمة على قاموس عبارات: تفحص كل الحقول النصية وتعيد مخالفة لكل مطابقة.
 */
export function phraseRule(
  spec: RuleSpec,
  phrases: readonly string[],
  message: (phrase: string) => string,
  options: { fields?: (field: string) => boolean; skip?: (draft: Draft) => boolean } = {},
): Rule {
  return {
    ...spec,
    run(draft) {
      if (options.skip?.(draft)) return [];

      return collectProse(draft)
        .filter((entry) => options.fields?.(entry.field) ?? true)
        .flatMap((entry) =>
          // غير متداخلة: تمنع ازدواج المخالفة حين تطابق عبارتان الموضع نفسه
          // («حقائق صادمة» و«صادم»، و«تعرف على» و«تعرّف على» بعد التطبيع).
          findPhrasesNonOverlapping(entry.value, phrases).map((match) =>
            makeFinding(spec, {
              field: entry.field,
              message: message(match.phrase),
              excerpt: match.excerpt,
              index: match.index,
            }),
          ),
        );
    },
  };
}
