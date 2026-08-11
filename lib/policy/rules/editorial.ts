/** بنود 5–6 و8–9: العناوين، المتن، المصادر، العاجل. */

import type { Rule } from "../types.ts";
import { countWords, findPhrases, hostOf } from "../normalize.ts";
import {
  APPROVED_KNOWLEDGE_HOSTS,
  APPROVED_WIRE_HOSTS,
  BODY_MAX_WORDS,
  BODY_MIN_WORDS,
  BREAKING_DAILY_LIMIT,
  BREAKING_SOURCE_HOSTS,
  CLICKBAIT_SOFT_TERMS,
  CLICKBAIT_TERMS,
  HEADLINE_MAX_WORDS,
  KNOW_DERIVATIVES,
  OFFICIAL_LOCAL_HOSTS,
  VIOLENCE_TERMS,
} from "../dictionary.ts";
import { makeFinding, phraseRule } from "./shared.ts";

const isHeadline = (field: string) => field === "title";
const isBody = (field: string) => field === "body";

const headlineLength: Rule = {
  id: "HEADLINE-MAX-WORDS",
  category: "headline",
  severity: "blocking",
  policyRef: "الدستور التحريري § 5",
  title: "حد كلمات العنوان",
  run(draft) {
    if (!draft.title) return [];
    const words = countWords(draft.title);
    if (words <= HEADLINE_MAX_WORDS) return [];

    return [
      makeFinding(headlineLength, {
        field: "title",
        message: `العنوان ${words} كلمة، والحد المعتمد ${HEADLINE_MAX_WORDS} كلمات. اختصره دون الإخلال بالمعنى.`,
        excerpt: draft.title,
      }),
    ];
  },
};

const headlineClickbait = phraseRule(
  {
    id: "HEADLINE-CLICKBAIT",
    category: "headline",
    severity: "blocking",
    policyRef: "الدستور التحريري § 5",
    title: "منع أساليب المبالغة",
  },
  CLICKBAIT_TERMS,
  (phrase) => `«${phrase}» من أساليب المبالغة الممنوعة في العناوين. اكتب العنوان بلغة معرفية دقيقة.`,
  { fields: isHeadline },
);

const headlineSoftClickbait = phraseRule(
  {
    id: "HEADLINE-CLICKBAIT-SOFT",
    category: "headline",
    severity: "warning",
    policyRef: "الدستور التحريري § 5",
    title: "مبالغة محتملة في العنوان",
  },
  CLICKBAIT_SOFT_TERMS,
  (phrase) => `راجع «${phrase}» في العنوان — تجنب الإيحاء بالإثارة إن لم يعكس المحتوى فعلًا.`,
  { fields: isHeadline },
);

const headlineKnowDerivatives = phraseRule(
  {
    id: "HEADLINE-KNOW-DERIVATIVES",
    category: "headline",
    severity: "blocking",
    policyRef: "الدستور التحريري § 5",
    title: "منع مشتقات «اعرف»",
  },
  KNOW_DERIVATIVES,
  (phrase) => `تمنع مشتقات «اعرف» في العناوين مثل «${phrase}». صُغ العنوان بجملة خبرية مباشرة.`,
  { fields: isHeadline },
);

const headlineViolence = phraseRule(
  {
    id: "HEADLINE-VIOLENCE",
    category: "headline",
    severity: "blocking",
    policyRef: "الدستور التحريري § 5",
    title: "منع ألفاظ العنف في العنوان",
  },
  VIOLENCE_TERMS,
  (phrase) => `«${phrase}» من ألفاظ العنف والقسوة الممنوعة في العناوين.`,
  { fields: isHeadline },
);

const bodyViolence = phraseRule(
  {
    id: "BODY-VIOLENCE",
    category: "body",
    severity: "warning",
    policyRef: "الدستور التحريري § 5",
    title: "ألفاظ العنف في المتن",
  },
  VIOLENCE_TERMS,
  (phrase) => `راجع لفظ «${phrase}» في المتن واستبدله بصياغة أقل قسوة إن أمكن.`,
  { fields: isBody },
);

const headlineMisleading: Rule = {
  id: "HEADLINE-MISLEADING",
  category: "headline",
  severity: "warning",
  policyRef: "الدستور التحريري § 5",
  title: "العنوان الخادع أو المضلل",
  run(draft) {
    if (!draft.title || !draft.body) return [];

    const headlineTerms = draft.title
      .split(/\s+/)
      .filter((token) => token.length > 3)
      .slice(0, 8);
    if (headlineTerms.length === 0) return [];

    const covered = headlineTerms.filter((term) => findPhrases(draft.body ?? "", [term]).length > 0);
    if (covered.length >= Math.ceil(headlineTerms.length / 2)) return [];

    return [
      makeFinding(headlineMisleading, {
        field: "title",
        message:
          "أغلب مفردات العنوان لا ترد في المتن — تحقق من أن العنوان يعكس المحتوى ولا يُعد خادعًا أو مضللًا.",
        excerpt: draft.title,
        needsHumanReview: true,
      }),
    ];
  },
};

const bodyWordRange: Rule = {
  id: "BODY-WORD-RANGE",
  category: "body",
  severity: "blocking",
  policyRef: "الدستور التحريري § 6",
  title: "طول المادة بين 300 و2000 كلمة",
  run(draft) {
    if (draft.body === undefined) return [];
    // الأسطح البصرية (جاك العلم وأشباهه) شرائح لا مقالًا — حد الكلمات قاعدة نصية (§6).
    if (draft.surface === "design") return [];
    const words = countWords(draft.body);
    if (words >= BODY_MIN_WORDS && words <= BODY_MAX_WORDS) return [];

    return [
      makeFinding(bodyWordRange, {
        field: "body",
        message:
          words < BODY_MIN_WORDS
            ? `المادة ${words} كلمة، والحد الأدنى ${BODY_MIN_WORDS} كلمة.`
            : `المادة ${words} كلمة، والحد الأعلى ${BODY_MAX_WORDS} كلمة. قسّمها أو اختصرها.`,
      }),
    ];
  },
};

const sourceRequired: Rule = {
  id: "SOURCE-REQUIRED",
  category: "sources",
  severity: "warning",
  policyRef: "الدستور التحريري § 8",
  title: "لا محتوى بلا مصدر",
  run(draft) {
    if ((draft.sourceUrls ?? []).length > 0) return [];

    return [
      makeFinding(sourceRequired, {
        field: "sourceUrls",
        message: "المحتوى بلا مصدر. أضف مصدرًا معتمدًا — «المحتوى بلا مصدر» مثال سلبي في خصائص «موثوق».",
      }),
    ];
  },
};

const APPROVED_HOSTS = [
  ...OFFICIAL_LOCAL_HOSTS,
  ...APPROVED_KNOWLEDGE_HOSTS,
  ...APPROVED_WIRE_HOSTS,
];

const sourceApprovedList: Rule = {
  id: "SOURCE-APPROVED-LIST",
  category: "sources",
  severity: "warning",
  policyRef: "الدستور التحريري § 8",
  title: "المصادر خارج القائمة تتطلب اعتماد مدير المحتوى",
  run(draft) {
    return (draft.sourceUrls ?? [])
      .map((url) => ({ url, host: hostOf(url) }))
      .filter(({ host }) => {
        if (!host) return true;
        if (host.endsWith(".gov.sa")) return false;
        return !APPROVED_HOSTS.some(
          (approved) => host === approved || host.endsWith(`.${approved}`),
        );
      })
      .map(({ url, host }) =>
        makeFinding(sourceApprovedList, {
          field: "sourceUrls",
          message: `المصدر «${host ?? url}» خارج قائمة المصادر المعتمدة؛ يلزم اعتماد مدير المحتوى قبل النشر.`,
          excerpt: url,
          needsHumanReview: true,
        }),
      );
  },
};

const breakingOveruse: Rule = {
  id: "BREAKING-OVERUSE",
  category: "breaking",
  severity: "warning",
  policyRef: "الدستور التحريري § 9",
  title: "عدم الإكثار من تصنيف «عاجل»",
  run(draft, context) {
    if (!draft.breaking) return [];
    const used = context.breakingCountToday ?? 0;
    const limit = context.breakingDailyLimit ?? BREAKING_DAILY_LIMIT;
    if (used < limit) return [];

    return [
      makeFinding(breakingOveruse, {
        field: "breaking",
        message: `صُنّفت ${used} مادة كـ«عاجل» اليوم والسقف ${limit}. الوثيقة تنص على عدم الإكثار من هذا التصنيف.`,
      }),
    ];
  },
};

const breakingSources: Rule = {
  id: "BREAKING-SOURCES",
  category: "breaking",
  severity: "warning",
  policyRef: "الدستور التحريري § 9",
  title: "مصادر العاجل الأولى",
  run(draft) {
    if (!draft.breaking) return [];

    const hosts = (draft.sourceUrls ?? []).map(hostOf).filter((host): host is string => host !== null);
    const hasApproved = hosts.some((host) =>
      BREAKING_SOURCE_HOSTS.some((approved) => host === approved || host.endsWith(`.${approved}`)),
    );
    if (hasApproved) return [];

    return [
      makeFinding(breakingSources, {
        field: "sourceUrls",
        message: "المصدر الأول للأخبار العاجلة: واس أو قناة الإخبارية أو قناة العربية. أضف أحدها قبل النشر.",
      }),
    ];
  },
};

export const editorialRules: Rule[] = [
  headlineLength,
  headlineClickbait,
  headlineSoftClickbait,
  headlineKnowDerivatives,
  headlineViolence,
  headlineMisleading,
  bodyViolence,
  bodyWordRange,
  sourceRequired,
  sourceApprovedList,
  breakingOveruse,
  breakingSources,
];
