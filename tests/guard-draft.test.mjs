import assert from "node:assert/strict";
import test from "node:test";

import { runConfiguredPolicyGuard } from "../lib/policy/index.ts";
import { buildGuardDraft, extractSourceUrls, isBreakingActive } from "../lib/tahrir/guard-draft.ts";

const CONTROLS = { editorialGuard: true, requireImageRights: true };
const SENTENCE = "تقدم المنصة معلومة معرفية موثقة عن الطاقة المتجددة في المملكة بلغة واضحة";
const compliant = (repeat = 30) => Array.from({ length: repeat }, () => `<p>${SENTENCE}</p>`).join("");
const ids = (report) => report.findings.map((finding) => finding.ruleId);
const future = () => new Date(Date.now() + 3_600_000).toISOString();
const past = () => new Date(Date.now() - 3_600_000).toISOString();

test("المسودة تحمل «عاجل» ومصادر المتن والسطح والوسائط من مدخل واحد", () => {
  const draft = buildGuardDraft({
    id: "s1",
    title: "كيف تعمل الطاقة المتجددة",
    body: '<p>نص <a href="https://www.spa.gov.sa/w1?a=1&amp;b=2">واس</a> و<a href="/series/x">داخلي</a> و<a href="https://www.spa.gov.sa/w1?a=1&amp;b=2">مكرر</a></p>',
    format: "jakalelm",
    image: "https://cdn.example/pic.jpg",
    breakingUntil: future(),
  });
  assert.equal(draft.id, "s1");
  assert.equal(draft.body, "نص واس وداخلي ومكرر");
  assert.equal(draft.surface, "design");
  assert.equal(draft.breaking, true);
  assert.deepEqual(draft.sourceUrls, ["https://www.spa.gov.sa/w1?a=1&b=2"]);
  assert.deepEqual(draft.media, [{ url: "https://cdn.example/pic.jpg", rightsCleared: false, flags: [] }]);

  const resolved = [{ id: "m1", url: "/uploads/a.webp", rightsCleared: true, flags: [] }];
  assert.deepEqual(buildGuardDraft({ title: "", body: "", image: "/uploads/a.webp", media: resolved }).media, resolved);
  assert.equal(buildGuardDraft({ title: "", body: "", format: "news" }).surface, undefined);
  assert.equal(buildGuardDraft({ title: "", body: "", breakingUntil: past() }).breaking, false);
  assert.equal(buildGuardDraft({ title: "", body: "", breakingUntil: "ليس تاريخًا" }).breaking, false);
});

test("«عاجل» ساري المفعول بالمستقبل فقط والروابط المطلقة http(s) وحدها مصادر", () => {
  assert.equal(isBreakingActive(null), false);
  assert.equal(isBreakingActive(future()), true);
  assert.equal(isBreakingActive(past()), false);
  assert.deepEqual(extractSourceUrls('<a href="javascript:x">a</a><a href="/local">b</a><a href=\'http://h.test/p\'>c</a>'), ["http://h.test/p"]);
});

test("مادة عاجلة بلا مصدر معتمد تطلق BREAKING-SOURCES عبر الحارس الحقيقي، ومع رابط واس لا تطلقها", () => {
  const breaking = buildGuardDraft({ title: "كيف تعمل الطاقة المتجددة في المملكة", body: compliant(), breakingUntil: future() });
  const report = runConfiguredPolicyGuard(breaking, CONTROLS, { breakingCountToday: 0 });
  assert.ok(ids(report).includes("BREAKING-SOURCES"), ids(report).join(","));

  const sourced = buildGuardDraft({
    title: "كيف تعمل الطاقة المتجددة في المملكة",
    body: `${compliant()}<p>المصدر: <a href="https://www.spa.gov.sa/w1234567">واس</a></p>`,
    breakingUntil: future(),
  });
  const ok = runConfiguredPolicyGuard(sourced, CONTROLS, { breakingCountToday: 0 });
  assert.equal(ids(ok).includes("BREAKING-SOURCES"), false, ids(ok).join(","));

  const notBreaking = buildGuardDraft({ title: "كيف تعمل الطاقة المتجددة في المملكة", body: compliant(), breakingUntil: past() });
  assert.equal(ids(runConfiguredPolicyGuard(notBreaking, CONTROLS)).includes("BREAKING-SOURCES"), false);
});

test("سقف العاجل اليومي من السياق يطلق BREAKING-OVERUSE ولا يطلقها تحت السقف", () => {
  const draft = buildGuardDraft({
    title: "كيف تعمل الطاقة المتجددة في المملكة",
    body: `${compliant()}<p><a href="https://www.spa.gov.sa/w1">واس</a></p>`,
    breakingUntil: future(),
  });
  assert.ok(ids(runConfiguredPolicyGuard(draft, CONTROLS, { breakingCountToday: 3, breakingDailyLimit: 3 })).includes("BREAKING-OVERUSE"));
  assert.equal(ids(runConfiguredPolicyGuard(draft, CONTROLS, { breakingCountToday: 2, breakingDailyLimit: 3 })).includes("BREAKING-OVERUSE"), false);
});

test("مصدر أجنبي في مادة عن المقامين يُكشف الآن من روابط المتن", () => {
  const draft = buildGuardDraft({
    title: "خادم الحرمين الشريفين يستقبل الوفد",
    body: `<p>استقبل خادم الحرمين الشريفين الوفد.</p>${compliant()}<p><a href="https://foreign.example/news/1">المصدر</a></p>`,
  });
  assert.ok(ids(runConfiguredPolicyGuard(draft, CONTROLS)).includes("ROYAL-FOREIGN-SOURCE"));
});
