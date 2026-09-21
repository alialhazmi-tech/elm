/** بنود 1–3: المقامان الرسميان، اسم الدولة ومؤسساتها، صفات المسؤولين. */

import type { Draft, Finding, Rule } from "../types.ts";
import { findPattern, hostOf, normalizeArabic } from "../normalize.ts";
import {
  ACADEMIC_TITLES,
  CROWN_PRINCE_FORBIDDEN_TERMS,
  CROWN_PRINCE_FULL_NAME,
  CROWN_PRINCE_SHORT_NAMES,
  DEFENCE_PORTFOLIO,
  FORBIDDEN_HONORIFICS,
  KING_FORBIDDEN_TERMS,
  KING_FULL_NAME,
  KING_SHORT_NAMES,
  NON_LOCAL_MINISTER_PATTERN,
  NON_LOCAL_MINISTRY_PATTERN,
  OFFICIAL_LOCAL_HOSTS,
  SOFT_HONORIFICS,
  STATE_FORBIDDEN_NAMES,
} from "../dictionary.ts";
import {
  abbreviationRule,
  collectProse,
  makeFinding,
  phraseRule,
  sentences,
  wholeText,
} from "./shared.ts";

const kingForbidden = phraseRule(
  {
    id: "ROYAL-KING-FORBIDDEN",
    category: "royal",
    severity: "blocking",
    policyRef: "الدستور التحريري § 1",
    title: "منع مصطلح «العاهل السعودي»",
  },
  KING_FORBIDDEN_TERMS,
  (phrase) =>
    `يمنع استخدام «${phrase}» لأي سبب. استخدم «خادم الحرمين الشريفين» أو «الملك سلمان» حسب موضع الاستخدام.`,
);

const crownPrinceForbidden = phraseRule(
  {
    id: "ROYAL-CP-FORBIDDEN",
    category: "royal",
    severity: "blocking",
    policyRef: "الدستور التحريري § 1",
    title: "منع «ولي العهد السعودي» وMBS ومبس",
  },
  CROWN_PRINCE_FORBIDDEN_TERMS,
  (phrase) =>
    `يمنع استخدام «${phrase}». الصيغة المعتمدة: «الأمير محمد بن سلمان بن عبدالعزيز آل سعود» في النصوص الخبرية، أو «ولي العهد» عند الاختصار.`,
);

const crownPrinceDefence: Rule = {
  id: "ROYAL-CP-DEFENCE",
  category: "royal",
  severity: "blocking",
  policyRef: "الدستور التحريري § 1",
  title: "عدم ذكر منصب وزير الدفاع لولي العهد",
  run(draft) {
    const portfolio = normalizeArabic(DEFENCE_PORTFOLIO);
    const references = [...CROWN_PRINCE_SHORT_NAMES, CROWN_PRINCE_FULL_NAME].map(normalizeArabic);

    return collectProse(draft).flatMap((entry) =>
      sentences(entry.value)
        .filter(
          (sentence) =>
            sentence.includes(portfolio) &&
            references.some((reference) => sentence.includes(reference)),
        )
        .map((sentence) =>
          makeFinding(crownPrinceDefence, {
            field: entry.field,
            message:
              "لا يُذكر منصب وزير الدفاع عند الحديث عن ولي العهد. احذف الإشارة إلى المنصب من الجملة.",
            excerpt: sentence.slice(0, 140),
          }),
        ),
    );
  },
};

const royalFullName: Rule = {
  id: "ROYAL-FULLNAME",
  category: "royal",
  severity: "warning",
  policyRef: "الدستور التحريري § 1",
  title: "الاسم والصفة كاملين في النصوص الخبرية",
  run(draft) {
    if (draft.surface === "design") return [];

    const text = wholeText(draft);
    const findings: Finding[] = [];

    const mentionsKing = KING_SHORT_NAMES.some((name) => text.includes(normalizeArabic(name)));
    if (mentionsKing && !text.includes(normalizeArabic(KING_FULL_NAME))) {
      findings.push(
        makeFinding(royalFullName, {
          field: "body",
          message: `النصوص الخبرية تتطلب الاسم والصفة كاملين عند أول ذكر: «${KING_FULL_NAME}». الاختصار مسموح في التصاميم والفيديو فقط.`,
        }),
      );
    }

    const mentionsCrownPrince = CROWN_PRINCE_SHORT_NAMES.some((name) =>
      text.includes(normalizeArabic(name)),
    );
    if (mentionsCrownPrince && !text.includes(normalizeArabic(CROWN_PRINCE_FULL_NAME))) {
      findings.push(
        makeFinding(royalFullName, {
          field: "body",
          message: `النصوص الخبرية تتطلب الاسم والصفة كاملين عند أول ذكر: «${CROWN_PRINCE_FULL_NAME}».`,
        }),
      );
    }

    return findings;
  },
};

const royalForeignSource: Rule = {
  id: "ROYAL-FOREIGN-SOURCE",
  category: "royal",
  severity: "blocking",
  policyRef: "الدستور التحريري § 1",
  title: "منع المصادر الأجنبية في مواد المقامين",
  run(draft) {
    const urls = draft.sourceUrls ?? [];
    if (urls.length === 0) return [];

    const text = wholeText(draft);
    const mentionsRoyalty = [...KING_SHORT_NAMES, ...CROWN_PRINCE_SHORT_NAMES, KING_FULL_NAME, CROWN_PRINCE_FULL_NAME]
      .map(normalizeArabic)
      .some((name) => text.includes(name));
    if (!mentionsRoyalty) return [];

    return urls
      .map((url) => ({ url, host: hostOf(url) }))
      .filter(({ host }) => {
        if (!host) return false;
        return !OFFICIAL_LOCAL_HOSTS.some(
          (approved) => host === approved || host.endsWith(`.${approved}`) || host.endsWith(".gov.sa"),
        );
      })
      .map(({ url, host }) =>
        makeFinding(royalForeignSource, {
          field: "sourceUrls",
          message: `لا يُتعامل مع أي مصدر أجنبي في مواد المقامين. المصدر «${host}» خارج المصادر المحلية المعتمدة؛ اعتمد على واس أو الجهات الرسمية.`,
          excerpt: url,
        }),
      );
  },
};

const stateForbiddenName = phraseRule(
  {
    id: "STATE-FORBIDDEN-NAME",
    category: "state",
    severity: "blocking",
    policyRef: "الدستور التحريري § 2",
    title: "منع التسميات غير الرسمية للدولة",
  },
  STATE_FORBIDDEN_NAMES,
  (phrase) =>
    `يمنع استخدام «${phrase}» في الإشارة إلى الدولة. الأسماء المعتمدة: المملكة العربية السعودية / المملكة / السعودية.`,
);

const stateLocalVoice: Rule = {
  id: "STATE-LOCAL-VOICE",
  category: "state",
  severity: "blocking",
  policyRef: "الدستور التحريري § 2",
  title: "منع الألقاب التي تبدو غير محلية",
  run(draft) {
    return collectProse(draft).flatMap((entry) =>
      [NON_LOCAL_MINISTER_PATTERN, NON_LOCAL_MINISTRY_PATTERN]
        .flatMap((pattern) => findPattern(entry.value, pattern))
        .map((match) =>
          makeFinding(stateLocalVoice, {
            field: entry.field,
            message:
              "توجه الموقع محلي: احذف نسبة الوزير أو الوزارة إلى «السعودي/السعودية» — اكتب «وزير الخارجية» و«وزارة الطاقة».",
            excerpt: match.excerpt,
            index: match.index,
          }),
        ),
    );
  },
};

const officialsHonorifics = phraseRule(
  {
    id: "OFFICIALS-HONORIFICS",
    category: "officials",
    severity: "blocking",
    policyRef: "الدستور التحريري § 3",
    title: "منع صفات المسؤولين",
  },
  FORBIDDEN_HONORIFICS,
  (phrase) =>
    `تُحذف صفة «${phrase}» من المحتوى، إلا إن كانت المادة إعلانًا مدفوعًا أو كانت جزءًا من لقب رسمي.`,
  { skip: (draft: Draft) => draft.paidPromotion === true },
);

const officialsSoftHonorifics = phraseRule(
  {
    id: "OFFICIALS-SOFT-HONORIFICS",
    category: "officials",
    severity: "warning",
    policyRef: "الدستور التحريري § 3",
    title: "صفات تستدعي المراجعة",
  },
  SOFT_HONORIFICS,
  (phrase) => `راجع استخدام «${phrase}»؛ الوثيقة تحصر الألقاب في المسميات الرسمية فقط.`,
  { skip: (draft: Draft) => draft.paidPromotion === true },
);

const officialsAcademic = abbreviationRule(
  {
    id: "OFFICIALS-ACADEMIC",
    category: "officials",
    severity: "suggestion",
    policyRef: "الدستور التحريري § 3",
    title: "اختصار الألقاب العلمية",
  },
  ACADEMIC_TITLES,
  (term, short) => `اختصر «${term}» إلى «${short}» وفق قواعد المحتوى المكتوب.`,
);

export const protocolRules: Rule[] = [
  kingForbidden,
  crownPrinceForbidden,
  crownPrinceDefence,
  royalFullName,
  royalForeignSource,
  stateForbiddenName,
  stateLocalVoice,
  officialsHonorifics,
  officialsSoftHonorifics,
  officialsAcademic,
];
