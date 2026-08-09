import assert from "node:assert/strict";
import test from "node:test";

import {
  allRules,
  applyAutofixes,
  guardWithAutofix,
  runPolicyGuard,
} from "../lib/policy/index.ts";

const COMPLIANT_SENTENCE =
  "تقدم المنصة معلومة معرفية موثقة عن الطاقة المتجددة في المملكة بلغة واضحة";

const compliantBody = (repeat = 30) => Array.from({ length: repeat }, () => COMPLIANT_SENTENCE).join(" ");

const baseDraft = () => ({
  id: "draft-1",
  title: "كيف تعمل الطاقة المتجددة في المملكة",
  body: compliantBody(),
  surface: "text",
  sourceUrls: ["https://www.spa.gov.sa/w1234567"],
});

const guard = (overrides = {}, context = {}) =>
  runPolicyGuard({ ...baseDraft(), ...overrides }, context);

const ruleIds = (report) => report.findings.map((finding) => finding.ruleId);
const has = (report, ruleId) => ruleIds(report).includes(ruleId);
const findingFor = (report, ruleId) => report.findings.find((f) => f.ruleId === ruleId);

test("المسودة الملتزمة تمر بلا أي مخالفة", () => {
  const report = guard();

  assert.deepEqual(report.findings, [], `مخالفات غير متوقعة: ${ruleIds(report).join(", ")}`);
  assert.equal(report.ok, true);
  assert.equal(report.canRequestApproval, true);
  assert.equal(report.rulesEvaluated, allRules.length);
});

test("كل قاعدة تحمل معرفًا فريدًا ومرجعًا في الدستور", () => {
  const ids = allRules.map((rule) => rule.id);

  assert.equal(new Set(ids).size, ids.length, "توجد معرفات مكررة");
  for (const rule of allRules) {
    assert.match(rule.policyRef, /الدستور التحريري/);
    assert.ok(rule.title.length > 0);
  }
});

test("ROYAL-KING-FORBIDDEN يمنع «العاهل السعودي» ويقاوم التشكيل واختلاف الألف", () => {
  const plain = guard({ body: `${compliantBody()} وقال العاهل السعودي في كلمته` });
  assert.ok(has(plain, "ROYAL-KING-FORBIDDEN"));
  assert.equal(plain.ok, false);
  assert.equal(plain.canRequestApproval, false);
  assert.equal(findingFor(plain, "ROYAL-KING-FORBIDDEN").severity, "blocking");

  const decorated = guard({ body: `${compliantBody()} وقال العَاهِل السعودى في كلمته` });
  assert.ok(has(decorated, "ROYAL-KING-FORBIDDEN"), "التطبيع يجب أن يكشف التشكيل والألف المقصورة");
});

test("ROYAL-CP-FORBIDDEN يمنع MBS ومبس و«ولي العهد السعودي»", () => {
  for (const term of ["MBS", "mbs", "مبس", "ولي العهد السعودي"]) {
    const report = guard({ body: `${compliantBody()} ${term} في لقاء` });
    assert.ok(has(report, "ROYAL-CP-FORBIDDEN"), `لم تُرصد الصيغة الممنوعة: ${term}`);
  }
});

test("ROYAL-CP-DEFENCE يمنع ذكر وزير الدفاع في جملة ولي العهد فقط", () => {
  const violation = guard({
    body: `${compliantBody()} التقى ولي العهد وزير الدفاع في الرياض.`,
  });
  assert.ok(has(violation, "ROYAL-CP-DEFENCE"));

  const separateSentences = guard({
    body: `${compliantBody()} التقى ولي العهد المسؤولين. وحضر وزير الدفاع الفرنسي الاجتماع.`,
  });
  assert.equal(has(separateSentences, "ROYAL-CP-DEFENCE"), false, "لا مخالفة عند اختلاف الجملة");
});

test("ROYAL-FULLNAME يطالب بالاسم الكامل في النصوص الخبرية دون التصاميم", () => {
  const news = guard({ body: `${compliantBody()} استقبل الملك سلمان الوفد` });
  assert.ok(has(news, "ROYAL-FULLNAME"));
  assert.equal(findingFor(news, "ROYAL-FULLNAME").severity, "warning");

  const design = guard({
    surface: "design",
    body: `${compliantBody()} استقبل الملك سلمان الوفد`,
  });
  assert.equal(has(design, "ROYAL-FULLNAME"), false);

  const full = guard({
    body: `${compliantBody()} استقبل خادم الحرمين الشريفين الملك سلمان بن عبدالعزيز آل سعود الوفد`,
  });
  assert.equal(has(full, "ROYAL-FULLNAME"), false);
});

test("ROYAL-FOREIGN-SOURCE يمنع المصادر الأجنبية في مواد المقامين", () => {
  const foreign = guard({
    body: `${compliantBody()} استقبل الملك سلمان الوفد`,
    sourceUrls: ["https://www.reuters.com/story"],
  });
  assert.ok(has(foreign, "ROYAL-FOREIGN-SOURCE"));
  assert.equal(foreign.ok, false);

  const local = guard({
    body: `${compliantBody()} استقبل الملك سلمان الوفد`,
    sourceUrls: ["https://www.spa.gov.sa/w1"],
  });
  assert.equal(has(local, "ROYAL-FOREIGN-SOURCE"), false);

  const unrelated = guard({ sourceUrls: ["https://www.reuters.com/story"] });
  assert.equal(has(unrelated, "ROYAL-FOREIGN-SOURCE"), false, "لا تسري القاعدة على مادة لا تخص المقامين");
});

test("STATE-FORBIDDEN-NAME يمنع «المملكة السعودية» ولا يمس الاسم الرسمي", () => {
  const violation = guard({ body: `${compliantBody()} أعلنت المملكة السعودية الخطة` });
  assert.ok(has(violation, "STATE-FORBIDDEN-NAME"));

  const official = guard({ body: `${compliantBody()} أعلنت المملكة العربية السعودية الخطة` });
  assert.equal(has(official, "STATE-FORBIDDEN-NAME"), false, "الاسم الرسمي يجب ألا يُرصد");
});

test("STATE-LOCAL-VOICE يمنع الصياغة غير المحلية للوزراء والوزارات", () => {
  const minister = guard({ body: `${compliantBody()} صرح وزير الخارجية السعودي أمس` });
  assert.ok(has(minister, "STATE-LOCAL-VOICE"));

  const ministry = guard({ body: `${compliantBody()} أعلنت وزارة الطاقة السعودية الخطة` });
  assert.ok(has(ministry, "STATE-LOCAL-VOICE"));

  const localVoice = guard({ body: `${compliantBody()} أعلنت وزارة الطاقة الخطة وصرح وزير الخارجية` });
  assert.equal(has(localVoice, "STATE-LOCAL-VOICE"), false);
});

test("OFFICIALS-HONORIFICS يمنع الصفات ويُرفع عن الإعلان المدفوع", () => {
  const violation = guard({ body: `${compliantBody()} التقى معالي الوزير بالفريق` });
  assert.ok(has(violation, "OFFICIALS-HONORIFICS"));
  assert.equal(violation.ok, false);

  const paid = guard({ paidPromotion: true, body: `${compliantBody()} التقى معالي الوزير بالفريق` });
  assert.equal(has(paid, "OFFICIALS-HONORIFICS"), false);
  assert.ok(has(paid, "AD-CONTROLS"), "المادة الإعلانية تُحوّل لضوابط المحتوى الإعلاني");
});

test("OFFICIALS-ACADEMIC يقترح اختصار الألقاب العلمية ويصلحها آليًا", () => {
  const report = guard({ body: `${compliantBody()} أوضح الدكتور أحمد الراجحي التفاصيل` });
  const finding = findingFor(report, "OFFICIALS-ACADEMIC");

  assert.ok(finding);
  assert.equal(finding.severity, "suggestion");
  assert.deepEqual(finding.autofix, { field: "body", from: "الدكتور", to: "د." });

  const fixed = applyAutofixes({ ...baseDraft(), body: "أوضح الدكتور أحمد" }, report.findings);
  assert.match(fixed.draft.body, /أوضح د\. أحمد/);
});

test("RESTRICTED-ISRAEL يمنع الطرح بلا واس ويحوّله لمراجعة بشرية مع واس", () => {
  const blocked = guard({
    body: `${compliantBody()} تناولت إسرائيل الملف`,
    sourceUrls: ["https://www.bbc.com/arabic"],
  });
  assert.ok(has(blocked, "RESTRICTED-ISRAEL"));
  assert.equal(findingFor(blocked, "RESTRICTED-ISRAEL").severity, "blocking");

  const viaWas = guard({
    body: `${compliantBody()} تناولت إسرائيل الملف`,
    sourceUrls: ["https://www.spa.gov.sa/w2"],
  });
  const finding = findingFor(viaWas, "RESTRICTED-ISRAEL");
  assert.equal(finding.severity, "warning");
  assert.equal(finding.needsHumanReview, true);
});

test("HEADLINE-MAX-WORDS يمنع العنوان الذي يتجاوز عشر كلمات", () => {
  const long = guard({
    title: "كيف تعمل الطاقة المتجددة في المملكة وما أثرها على الاقتصاد الوطني خلال العقد",
  });
  assert.ok(has(long, "HEADLINE-MAX-WORDS"));
  assert.equal(long.ok, false);

  const exact = guard({ title: "واحد اثنان ثلاثة أربعة خمسة ستة سبعة ثمانية تسعة عشرة" });
  assert.equal(has(exact, "HEADLINE-MAX-WORDS"), false, "عشر كلمات مسموحة");
});

test("محظورات العناوين: المبالغة ومشتقات اعرف وألفاظ العنف", () => {
  assert.ok(has(guard({ title: "حقائق صادمة عن الطاقة" }), "HEADLINE-CLICKBAIT"));
  assert.ok(has(guard({ title: "تعرف على الطاقة المتجددة" }), "HEADLINE-KNOW-DERIVATIVES"));

  const violence = guard({ title: "جريمة في مدينة الرياض" });
  assert.ok(has(violence, "HEADLINE-VIOLENCE"));
  assert.equal(findingFor(violence, "HEADLINE-VIOLENCE").severity, "blocking");

  const bodyViolence = guard({ body: `${compliantBody()} وقعت جريمة في الحي` });
  assert.equal(has(bodyViolence, "HEADLINE-VIOLENCE"), false, "القاعدة مقصورة على العنوان");
  assert.equal(findingFor(bodyViolence, "BODY-VIOLENCE").severity, "warning");
});

test("BODY-WORD-RANGE يفرض نطاق 300 إلى 2000 كلمة", () => {
  const short = guard({ body: "مادة قصيرة جدًا لا تكفي" });
  assert.ok(has(short, "BODY-WORD-RANGE"));
  assert.match(findingFor(short, "BODY-WORD-RANGE").message, /الحد الأدنى/);

  const long = guard({ body: compliantBody(200) });
  assert.ok(has(long, "BODY-WORD-RANGE"));
  assert.match(findingFor(long, "BODY-WORD-RANGE").message, /الحد الأعلى/);
});

test("قواعد المصادر: الإلزام بالمصدر والتحويل للاعتماد خارج القائمة", () => {
  const missing = guard({ sourceUrls: [] });
  assert.ok(has(missing, "SOURCE-REQUIRED"));
  assert.equal(missing.ok, true, "غياب المصدر تحذير لا منع");

  const unknown = guard({ sourceUrls: ["https://example.com/post"] });
  const finding = findingFor(unknown, "SOURCE-APPROVED-LIST");
  assert.equal(finding.severity, "warning");
  assert.equal(finding.needsHumanReview, true);

  const approved = guard({ sourceUrls: ["https://ourworldindata.org/energy"] });
  assert.equal(has(approved, "SOURCE-APPROVED-LIST"), false);
});

test("ضوابط العاجل: السقف اليومي والمصادر الأولى", () => {
  const overused = guard(
    { breaking: true },
    { breakingCountToday: 6, breakingDailyLimit: 5 },
  );
  assert.ok(has(overused, "BREAKING-OVERUSE"));

  const withinLimit = guard({ breaking: true }, { breakingCountToday: 1, breakingDailyLimit: 5 });
  assert.equal(has(withinLimit, "BREAKING-OVERUSE"), false);
  assert.equal(has(withinLimit, "BREAKING-SOURCES"), false, "واس مصدر معتمد للعاجل");

  const wrongSource = guard(
    { breaking: true, sourceUrls: ["https://ourworldindata.org/energy"] },
    { breakingCountToday: 0 },
  );
  assert.ok(has(wrongSource, "BREAKING-SOURCES"));
});

test("قواعد التنسيق: الأرقام والتواريخ والوحدات وأسماء المنصات", () => {
  const digits = guard({ body: `${compliantBody()} بلغت النسبة ٥٠ بالمئة` });
  assert.deepEqual(findingFor(digits, "FORMAT-LATIN-DIGITS").autofix, {
    field: "body",
    from: "٥٠",
    to: "50",
  });

  const marker = guard({ body: `${compliantBody()} صدر القرار عام 1444هـ` });
  assert.deepEqual(findingFor(marker, "FORMAT-DATE-MARKER").autofix, {
    field: "body",
    from: "1444هـ",
    to: "1444",
  });

  const meters = guard({ body: `${compliantBody()} يبلغ الارتفاع 500 م فوق السطح` });
  assert.equal(has(meters, "FORMAT-DATE-MARKER"), false, "«م» بعد رقم غير سنة ليست علامة تاريخ");

  const units = guard({ body: `${compliantBody()} تبعد المدينة 40 كيلومتر عن الساحل` });
  assert.deepEqual(findingFor(units, "FORMAT-UNITS").autofix, {
    field: "body",
    from: "كيلومتر",
    to: "كلم",
  });

  // المصطلح الأطول يفوز: «كيلومترات» لا تُقص إلى «كلمات» بمطابقة «كيلومتر» بداخلها.
  const plural = guard({ body: `${compliantBody()} تمتد المسافة عشرة كيلومترات كاملة` });
  const pluralFix = findingFor(plural, "FORMAT-UNITS").autofix;
  assert.deepEqual(pluralFix, { field: "body", from: "كيلومترات", to: "كلم" });
  assert.match(
    applyAutofixes({ ...baseDraft(), body: "عشرة كيلومترات كاملة" }, plural.findings).draft.body,
    /عشرة كلم كاملة/,
  );

  const platform = guard({ body: `${compliantBody()} نشرت الجهة عبر فيسبوك` });
  assert.deepEqual(findingFor(platform, "FORMAT-PLATFORM-LATIN").autofix, {
    field: "body",
    from: "فيسبوك",
    to: "Facebook",
  });

  const numericDate = guard({ body: `${compliantBody()} صدر في 29/03/2023 القرار` });
  assert.ok(has(numericDate, "FORMAT-DATE-SHAPE"));
});

test("ضوابط الإنفوجرافيك تفرض حدود النقاط والمقدمة", () => {
  const report = guard({
    infographic: {
      intro: "مقدمة طويلة جدًا تتجاوز الحد المسموح به وفق ضوابط الوثيقة المعتمدة لدينا اليوم",
      points: Array.from({ length: 10 }, () => "نقطة قصيرة"),
    },
  });

  const messages = report.findings
    .filter((finding) => finding.ruleId === "INFOGRAPHIC-LIMITS")
    .map((finding) => finding.message);

  assert.ok(messages.some((message) => message.includes("مقدمة")));
  assert.ok(messages.some((message) => message.includes("مادتين")));
});

test("ضوابط الفيديوجرافيك تفرض عدد المشاهد وكلماتها", () => {
  const report = guard({
    videographic: {
      intro: "مقدمة بلا سؤال",
      scenes: ["مشهد قصير", "مشهد آخر"],
      outro: "خاتمة بلا سؤال",
    },
  });

  const findings = report.findings.filter((finding) => finding.ruleId === "VIDEOGRAPHIC-LIMITS");
  assert.ok(findings.some((finding) => finding.message.includes("عدد المشاهد")));
  assert.ok(findings.some((finding) => finding.severity === "suggestion"));
});

test("حدود النص المصاحب لكل منصة", () => {
  const report = guard({
    social: [
      { platform: "twitter", text: Array.from({ length: 25 }, () => "كلمة").join(" "), hashtags: ["#العلم"] },
      { platform: "instagram", text: "نص قصير", hashtags: Array.from({ length: 8 }, (_, i) => `#وسم${i}`) },
      { platform: "facebook", text: "نص قصير", hashtags: ["#أ", "#ب", "#ج"] },
    ],
  });

  const social = report.findings.filter((finding) => finding.ruleId === "SOCIAL-CAPTION-LIMITS");
  assert.ok(social.some((f) => f.field === "social[0].text"));
  assert.ok(social.some((f) => f.field === "social[0].hashtags" && f.needsHumanReview));
  assert.ok(social.some((f) => f.field === "social[1].hashtags"));
  assert.ok(social.some((f) => f.field === "social[2].hashtags"));
});

test("معايير نشر الصور: الحقوق والمحظورات والتطابق", () => {
  const report = guard({
    media: [
      { url: "https://media.alelm.net/a.webp", rightsCleared: false },
      { url: "https://media.alelm.net/b.webp", rightsCleared: true, flags: ["gore"] },
      { url: "https://media.alelm.net/c.webp", rightsCleared: true, flags: ["personal-handle"] },
      { url: "https://media.alelm.net/d.webp", rightsCleared: true, personName: "أحمد الراجحي" },
    ],
  });

  const media = report.findings.filter((finding) => finding.ruleId === "MEDIA-COMPLIANCE");
  assert.equal(media.filter((finding) => finding.severity === "blocking").length, 2);
  assert.ok(media.some((finding) => finding.severity === "warning" && finding.needsHumanReview));
  assert.equal(report.ok, false);
});

test("guardWithAutofix يطبّق التصحيحات ثم يعيد الفحص", () => {
  const draft = {
    ...baseDraft(),
    body: `${compliantBody()} بلغت النسبة ٥٠ بالمئة عبر فيسبوك`,
  };

  const { draft: fixed, report, autofixesApplied } = guardWithAutofix(draft);

  assert.ok(autofixesApplied >= 2);
  assert.match(fixed.body, /50 بالمئة/);
  assert.match(fixed.body, /Facebook/);
  assert.equal(report.counts.suggestion, 0, "لا تبقى اقتراحات بعد الإصلاح الآلي");
});

test("سجل التدقيق يحمل القواعد القاطعة ومعرف المنفذ", () => {
  const report = guard(
    { body: `${compliantBody()} وقال العاهل السعودي` },
    { actorId: "editor-7" },
  );

  assert.equal(report.audit.actorId, "editor-7");
  assert.equal(report.audit.draftId, "draft-1");
  assert.ok(report.audit.blockingRuleIds.includes("ROYAL-KING-FORBIDDEN"));
});
