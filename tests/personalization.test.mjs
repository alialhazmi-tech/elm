import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDecay,
  applyEvent,
  applySignalToScores,
  classifyStoryHeuristic,
  clampDuration,
  clampProgress,
  crossedMilestones,
  diversityPass,
  emptyStats,
  ENGAGED_MS,
  isPubliclyRecommendable,
  rankCandidates,
  recentlyReadIds,
  recommendationReason,
  relatedness,
  sanitizeEvent,
  sanitizeEventBatch,
  storyInterestScore,
  topicKey,
  WEIGHTS,
} from "../lib/personalization/math.ts";
import { safeInternalPath } from "../lib/membership/paths.ts";

const catalog = [
  { id: "health", label: "الصحة", contentKeys: ["health", "صحة"] },
  { id: "technology", label: "التقنية", contentKeys: ["technology", "تقنية"] },
];

const nowIso = "2026-08-12T12:00:00.000Z";
const now = Date.parse(nowIso);

const healthStory = {
  id: "s-health",
  section: "health",
  series: "absat",
  format: "news",
  title: "كيف تنام نومًا أفضل",
  excerpt: "مادة عن الصحة والنوم",
  keywords: ["صحة", "نوم"],
  publishedAt: "2026-08-11T10:00:00.000Z",
  status: "published",
};

const techStory = {
  id: "s-tech",
  section: "technology",
  series: "aghrab",
  format: "news",
  title: "هاتف جديد",
  excerpt: "مادة عن التقنية",
  keywords: ["تقنية"],
  publishedAt: "2026-08-10T10:00:00.000Z",
  status: "published",
};

const draftStory = { ...techStory, id: "s-draft", status: "draft" };
const scheduledStory = { ...healthStory, id: "s-sched", publishedAt: "2026-12-01T00:00:00.000Z" };

test("الإعجاب وإلغاؤه يحدّثان الدرجة دون تكرار", () => {
  let stats = emptyStats(nowIso);
  const liked = applyEvent(stats, { type: "like", storyId: "s1" }, nowIso);
  assert.equal(liked.stats.liked, 1);
  assert.equal(liked.persistEvent, true);
  assert.equal(liked.topicDelta, WEIGHTS.like);
  const again = applyEvent(liked.stats, { type: "like", storyId: "s1" }, nowIso);
  assert.equal(again.persistEvent, false);
  const unliked = applyEvent(liked.stats, { type: "unlike", storyId: "s1" }, nowIso);
  assert.equal(unliked.stats.liked, 0);
  assert.equal(unliked.topicDelta, WEIGHTS.unlike);
});

test("تجميع مدة القراءة يتجاهل القيم غير المنطقية", () => {
  assert.equal(clampDuration(-12), 0);
  assert.equal(clampDuration(Number.NaN), 0);
  assert.equal(clampDuration(90_000), 30_000);
  assert.equal(clampProgress(140), 100);
  let stats = emptyStats(nowIso);
  const first = applyEvent(stats, { type: "reading_progress", storyId: "s1", durationMs: 20_000, value: 30 }, nowIso);
  const second = applyEvent(first.stats, { type: "reading_progress", storyId: "s1", durationMs: 80_000, value: 55 }, nowIso);
  assert.equal(second.stats.activeMs, 50_000);
  assert.equal(second.stats.maxProgress, 55);
  assert.equal(second.engagedNow, true);
  assert.ok(second.stats.interestScore >= WEIGHTS.engagedRead);
});

test("مراحل التقدم تُسجَّل عند العبور فقط", () => {
  assert.deepEqual(crossedMilestones(10, 20), []);
  assert.deepEqual(crossedMilestones(20, 50), [25, 50]);
  assert.deepEqual(crossedMilestones(80, 95), [90]);
});

test("سؤال الختام تراكمي ولا يُستبدل", () => {
  let stats = emptyStats(nowIso);
  const first = applyEvent(stats, { type: "closing_answer", storyId: "s1", value: 0 }, nowIso);
  assert.equal(first.stats.closingAnswer, 0);
  assert.equal(first.topicDelta, WEIGHTS.closingNew);
  const second = applyEvent(first.stats, { type: "closing_answer", storyId: "s1", value: 1 }, nowIso);
  assert.equal(second.persistEvent, false);
  assert.equal(second.stats.closingAnswer, 0);
});

test("أدوات الذكاء تُحتسب بعد الحدث لا قبله، والأولى أقوى", () => {
  let stats = emptyStats(nowIso);
  const first = applyEvent(stats, { type: "ai_summary", storyId: "s1" }, nowIso);
  assert.equal(first.persistEvent, true);
  assert.equal(first.topicDelta, WEIGHTS.aiSummary);
  const second = applyEvent(first.stats, { type: "ai_summary", storyId: "s1" }, nowIso);
  assert.ok(second.topicDelta < first.topicDelta);
  const discuss = applyEvent(first.stats, { type: "ai_discuss", storyId: "s1" }, nowIso);
  assert.equal(discuss.topicDelta, WEIGHTS.aiDiscuss);
  assert.ok(discuss.stats.aiTools.includes("summary"));
  assert.ok(discuss.stats.aiTools.includes("discuss"));
});

test("sanitize يتجاهل memberId والأنواع المجهولة", () => {
  assert.equal(sanitizeEvent({ type: "hack", storyId: "s1", memberId: "other" }), null);
  const ok = sanitizeEvent({ type: "like", storyId: "263004", memberId: "attacker" });
  assert.equal(ok?.type, "like");
  assert.equal(ok?.storyId, "263004");
  assert.equal("memberId" in (ok ?? {}), false);
  assert.equal(sanitizeEventBatch(Array.from({ length: 50 }, () => ({ type: "like", storyId: "s1" }))).length, 20);
});

test("decay يضعف الاهتمام القديم", () => {
  const fresh = applyDecay(1000, nowIso, now);
  const old = applyDecay(1000, "2026-07-01T12:00:00.000Z", now);
  assert.equal(fresh, 1000);
  assert.ok(old < 600);
});

test("تحديث interest score من الإشارات", () => {
  const stats = {
    ...emptyStats(nowIso),
    liked: 1,
    activeMs: ENGAGED_MS,
    maxProgress: 90,
    visits: 2,
    usedAi: 1,
    aiTools: ["simplify"],
    closingAnswer: 0,
  };
  const score = storyInterestScore(stats);
  assert.ok(score >= WEIGHTS.like + WEIGHTS.engagedRead + WEIGHTS.aiSimplify + WEIGHTS.closingNew);
});

test("applySignalToScores لا ينزل تحت أرضية الاهتمام الصريح", () => {
  const scores = [
    { topicKey: topicKey("interest", "health"), kind: "interest", source: "explicit", weight: 1000, updatedAt: nowIso },
  ];
  const topics = classifyStoryHeuristic(healthStory, catalog);
  const next = applySignalToScores(scores, topics, WEIGHTS.unlike, "like", nowIso, now);
  const health = next.find((row) => row.topicKey === topicKey("interest", "health"));
  assert.ok(health);
  assert.equal(health.source, "explicit");
  assert.ok(health.weight >= WEIGHTS.explicit);
});

test("استبعاد غير المنشور والمجدول", () => {
  assert.equal(isPubliclyRecommendable(healthStory, now), true);
  assert.equal(isPubliclyRecommendable(draftStory, now), false);
  assert.equal(isPubliclyRecommendable(scheduledStory, now), false);
});

test("الترتيب يقدّم اهتمام العضو مع صلة المادة", () => {
  const memberScores = [
    { topicKey: topicKey("interest", "health"), kind: "interest", source: "explicit", weight: 1000, updatedAt: nowIso },
  ];
  const ranked = rankCandidates({
    candidates: [techStory, healthStory, draftStory, scheduledStory],
    current: { ...techStory, id: "current", section: "health", series: "absat", title: "نوم" },
    memberScores,
    topicsByStory: {},
    catalog,
    now,
  });
  assert.equal(ranked.some((item) => item.id === "s-draft"), false);
  assert.equal(ranked.some((item) => item.id === "s-sched"), false);
  assert.equal(ranked[0].id, "s-health");
});

test("diversity يمنع تشابه الأقسام المتجاور ويستبعد المقروء إن وُجد بديل", () => {
  const ranked = [
    { ...healthStory, id: "a", score: 9, reason: { code: "x", text: "" }, relatedness: 1, interest: 1, recency: 1 },
    { ...healthStory, id: "b", score: 8, reason: { code: "x", text: "" }, relatedness: 1, interest: 1, recency: 1 },
    { ...healthStory, id: "c", score: 7, reason: { code: "x", text: "" }, relatedness: 1, interest: 1, recency: 1 },
    { ...techStory, id: "d", score: 6, reason: { code: "x", text: "" }, relatedness: 0.2, interest: 0.4, recency: 1 },
    { ...techStory, id: "e", section: "economy", score: 5, reason: { code: "x", text: "" }, relatedness: 0.1, interest: 0.2, recency: 1 },
  ];
  const picked = diversityPass(ranked, {
    limit: 3,
    recentlyReadIds: new Set(["a"]),
    currentSection: "health",
    discovery: true,
  });
  assert.equal(picked.some((item) => item.id === "a"), false);
  assert.ok(picked.length <= 3);
  const sections = picked.map((item) => item.section);
  assert.ok(new Set(sections).size >= 2);
});

test("سبب التوصية متاح داخليًا", () => {
  const reason = recommendationReason(
    healthStory,
    techStory,
    [{ topicKey: topicKey("interest", "health"), kind: "interest", source: "like", weight: 800, updatedAt: nowIso }],
    { interestLabels: { health: "الصحة" } },
  );
  assert.equal(reason.code, "like");
  assert.match(reason.text, /أعجبت/);
});

test("relatedness أعلى لنفس السلسلة", () => {
  assert.ok(relatedness(healthStory, { ...techStory, series: "absat", section: "health" }) > relatedness(techStory, healthStory));
});

test("recentlyReadIds يلتقط القراءة العميقة الحديثة فقط", () => {
  const ids = recentlyReadIds(
    [
      { storyId: "deep", activeMs: ENGAGED_MS, maxProgress: 80, lastVisitAt: nowIso },
      { storyId: "old", activeMs: ENGAGED_MS, maxProgress: 80, lastVisitAt: "2026-01-01T00:00:00.000Z" },
      { storyId: "skim", activeMs: 1000, maxProgress: 10, lastVisitAt: nowIso },
    ],
    now,
  );
  assert.deepEqual([...ids], ["deep"]);
});

test("المسار الداخلي الآمن يرفض التحويل المفتوح", () => {
  assert.equal(safeInternalPath("/health/1/slug"), "/health/1/slug");
  assert.equal(safeInternalPath("https://evil.test"), null);
  assert.equal(safeInternalPath("//evil.test"), null);
  assert.equal(safeInternalPath("/join"), null);
});
