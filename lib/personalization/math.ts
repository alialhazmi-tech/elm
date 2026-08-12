/**
 * حسابات التخصيص النقية — بلا قاعدة بيانات ولا طلبات شبكة.
 * الأوزان millipoints (1000 = اهتمام صريح واحد) وقابلة للتعديل من اختبار واحد.
 */

export const WEIGHTS = {
  explicit: 1000,
  like: 400,
  unlike: -400,
  engagedRead: 250,
  open: 20,
  progress90: 80,
  aiSummary: 80,
  aiSimplify: 140,
  aiDiscuss: 220,
  listen: 90,
  relatedClick: 60,
  closingNew: 180,
  closingKnew: 40,
} as const;

export const ENGAGED_MS = 45_000;
export const ENGAGED_PROGRESS = 50;
export const MAX_FLUSH_MS = 30_000;
export const HALF_LIFE_DAYS = 21;
export const MAX_EVENTS_PER_REQUEST = 20;
export const MAX_STORY_ID_LEN = 80;
export const PROGRESS_MARKS = [25, 50, 75, 90] as const;

export const EVENT_TYPES = [
  "article_open",
  "reading_progress",
  "engaged_read",
  "like",
  "unlike",
  "ai_summary",
  "ai_simplify",
  "ai_discuss",
  "listen",
  "related_click",
  "closing_answer",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type TopicKind = "interest" | "section" | "series" | "format" | "keyword";
export type TopicSource = "explicit" | "inferred" | "like" | "deep_read" | "ai";

export type TopicScore = {
  topicKey: string;
  kind: TopicKind;
  source: TopicSource;
  weight: number;
  updatedAt: string;
};

export type StoryTopic = {
  topicKey: string;
  kind: TopicKind;
  weight: number;
};

export type StoryStats = {
  activeMs: number;
  maxProgress: number;
  visits: number;
  lastVisitAt: string;
  liked: number;
  usedAi: number;
  aiTools: string[];
  closingAnswer: number | null;
  interestScore: number;
};

export type IncomingEvent = {
  type: EventType;
  storyId: string;
  value?: number | null;
  durationMs?: number | null;
};

export type RankableStory = {
  id: string;
  section: string;
  series?: string;
  format?: string;
  title: string;
  excerpt?: string;
  keywords?: string[];
  publishedAt?: string;
  status?: string;
  hidden?: boolean;
};

export type RankedItem = RankableStory & {
  score: number;
  reason: { code: string; text: string };
  relatedness: number;
  interest: number;
  recency: number;
};

export type InterestCatalogItem = {
  id: string;
  label: string;
  contentKeys: string[];
};

const EVENT_TYPE_SET = new Set<string>(EVENT_TYPES);

export function emptyStats(nowIso = new Date().toISOString()): StoryStats {
  return {
    activeMs: 0,
    maxProgress: 0,
    visits: 0,
    lastVisitAt: nowIso,
    liked: 0,
    usedAi: 0,
    aiTools: [],
    closingAnswer: null,
    interestScore: 0,
  };
}

export function clampDuration(ms: unknown): number {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(MAX_FLUSH_MS, Math.round(ms));
}

export function clampProgress(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(100, Math.round(value));
}

export function applyDecay(
  weight: number,
  lastUpdatedIso: string,
  now = Date.now(),
  halfLifeDays = HALF_LIFE_DAYS,
): number {
  if (!Number.isFinite(weight) || weight <= 0) return 0;
  const then = Date.parse(lastUpdatedIso);
  if (!Number.isFinite(then)) return Math.round(weight);
  const ageDays = Math.max(0, (now - then) / 86_400_000);
  if (ageDays === 0) return Math.round(weight);
  return Math.round(weight * 0.5 ** (ageDays / halfLifeDays));
}

export function crossedMilestones(previous: number, next: number): number[] {
  return PROGRESS_MARKS.filter((mark) => previous < mark && next >= mark);
}

export function isPubliclyRecommendable(story: RankableStory, now = Date.now()): boolean {
  if (story.status && story.status !== "published") return false;
  if (story.hidden) return false;
  if (story.publishedAt) {
    const at = Date.parse(story.publishedAt);
    if (Number.isFinite(at) && at > now) return false;
  }
  return true;
}

export function sanitizeEvent(raw: unknown): IncomingEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.type !== "string" || !EVENT_TYPE_SET.has(row.type)) return null;
  if (typeof row.storyId !== "string" || !row.storyId || row.storyId.length > MAX_STORY_ID_LEN) {
    return null;
  }
  if (/[^a-zA-Z0-9._%-]/.test(row.storyId)) return null;
  return {
    type: row.type as EventType,
    storyId: row.storyId,
    value: typeof row.value === "number" && Number.isFinite(row.value) ? row.value : null,
    durationMs: typeof row.durationMs === "number" && Number.isFinite(row.durationMs) ? row.durationMs : null,
  };
}

export function sanitizeEventBatch(raw: unknown): IncomingEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: IncomingEvent[] = [];
  for (const item of raw) {
    const event = sanitizeEvent(item);
    if (event) out.push(event);
    if (out.length >= MAX_EVENTS_PER_REQUEST) break;
  }
  return out;
}

export function storyInterestScore(stats: StoryStats): number {
  let score = 0;
  if (stats.liked) score += WEIGHTS.like;
  if (stats.activeMs >= ENGAGED_MS && stats.maxProgress >= ENGAGED_PROGRESS) score += WEIGHTS.engagedRead;
  score += Math.min(80, stats.visits * WEIGHTS.open);
  if (stats.maxProgress >= 90) score += WEIGHTS.progress90;
  if (stats.aiTools.includes("summary")) score += WEIGHTS.aiSummary;
  if (stats.aiTools.includes("simplify")) score += WEIGHTS.aiSimplify;
  if (stats.aiTools.includes("discuss")) score += WEIGHTS.aiDiscuss;
  if (stats.aiTools.includes("listen")) score += WEIGHTS.listen;
  if (stats.closingAnswer === 0) score += WEIGHTS.closingNew;
  if (stats.closingAnswer === 1) score += WEIGHTS.closingKnew;
  return score;
}

export type ApplyResult = {
  stats: StoryStats;
  persistEvent: boolean;
  topicDelta: number;
  topicSource: TopicSource | null;
  milestones: number[];
  engagedNow: boolean;
};

function withTool(stats: StoryStats, tool: string): StoryStats {
  if (stats.aiTools.includes(tool)) return stats;
  return { ...stats, usedAi: 1, aiTools: [...stats.aiTools, tool] };
}

export function applyEvent(stats: StoryStats, event: IncomingEvent, nowIso: string): ApplyResult {
  const next = { ...stats, aiTools: [...stats.aiTools], lastVisitAt: nowIso };
  const none: ApplyResult = {
    stats: { ...next, interestScore: storyInterestScore(next) },
    persistEvent: false,
    topicDelta: 0,
    topicSource: null,
    milestones: [],
    engagedNow: false,
  };

  switch (event.type) {
    case "article_open": {
      next.visits += 1;
      return {
        stats: { ...next, interestScore: storyInterestScore(next) },
        persistEvent: true,
        topicDelta: WEIGHTS.open,
        topicSource: "inferred",
        milestones: [],
        engagedNow: false,
      };
    }
    case "reading_progress": {
      const duration = clampDuration(event.durationMs);
      const progress = clampProgress(event.value);
      if (duration === 0 && progress <= next.maxProgress) return none;
      const prevProgress = next.maxProgress;
      next.activeMs += duration;
      next.maxProgress = Math.max(next.maxProgress, progress);
      const milestones = crossedMilestones(prevProgress, next.maxProgress);
      const wasEngaged = stats.activeMs >= ENGAGED_MS && stats.maxProgress >= ENGAGED_PROGRESS;
      const engagedNow = !wasEngaged && next.activeMs >= ENGAGED_MS && next.maxProgress >= ENGAGED_PROGRESS;
      let topicDelta = 0;
      if (milestones.includes(90)) topicDelta += WEIGHTS.progress90;
      if (engagedNow) topicDelta += WEIGHTS.engagedRead;
      return {
        stats: { ...next, interestScore: storyInterestScore(next) },
        persistEvent: milestones.length > 0 || engagedNow,
        topicDelta,
        topicSource: engagedNow ? "deep_read" : topicDelta ? "inferred" : null,
        milestones,
        engagedNow,
      };
    }
    case "engaged_read": {
      const wasEngaged = stats.activeMs >= ENGAGED_MS && stats.maxProgress >= ENGAGED_PROGRESS;
      if (wasEngaged) return none;
      next.activeMs = Math.max(next.activeMs, ENGAGED_MS);
      next.maxProgress = Math.max(next.maxProgress, ENGAGED_PROGRESS);
      return {
        stats: { ...next, interestScore: storyInterestScore(next) },
        persistEvent: true,
        topicDelta: WEIGHTS.engagedRead,
        topicSource: "deep_read",
        milestones: [],
        engagedNow: true,
      };
    }
    case "like": {
      if (next.liked === 1) return { ...none, stats: { ...next, liked: 1, interestScore: storyInterestScore({ ...next, liked: 1 }) } };
      next.liked = 1;
      return {
        stats: { ...next, interestScore: storyInterestScore(next) },
        persistEvent: true,
        topicDelta: WEIGHTS.like,
        topicSource: "like",
        milestones: [],
        engagedNow: false,
      };
    }
    case "unlike": {
      if (next.liked === 0) return none;
      next.liked = 0;
      return {
        stats: { ...next, interestScore: storyInterestScore(next) },
        persistEvent: true,
        topicDelta: WEIGHTS.unlike,
        topicSource: "like",
        milestones: [],
        engagedNow: false,
      };
    }
    case "ai_summary":
    case "ai_simplify":
    case "ai_discuss":
    case "listen": {
      const tool = event.type === "listen" ? "listen" : event.type.replace("ai_", "");
      const first = !stats.aiTools.includes(tool);
      const updated = withTool(next, tool);
      const delta =
        event.type === "ai_summary"
          ? WEIGHTS.aiSummary
          : event.type === "ai_simplify"
            ? WEIGHTS.aiSimplify
            : event.type === "ai_discuss"
              ? WEIGHTS.aiDiscuss
              : WEIGHTS.listen;
      return {
        stats: { ...updated, interestScore: storyInterestScore(updated) },
        persistEvent: true,
        topicDelta: first ? delta : Math.round(delta * 0.15),
        topicSource: "ai",
        milestones: [],
        engagedNow: false,
      };
    }
    case "related_click": {
      return {
        stats: { ...next, interestScore: storyInterestScore(next) },
        persistEvent: true,
        topicDelta: WEIGHTS.relatedClick,
        topicSource: "inferred",
        milestones: [],
        engagedNow: false,
      };
    }
    case "closing_answer": {
      if (next.closingAnswer !== null) return none;
      const answer = event.value === 1 ? 1 : 0;
      next.closingAnswer = answer;
      return {
        stats: { ...next, interestScore: storyInterestScore(next) },
        persistEvent: true,
        topicDelta: answer === 0 ? WEIGHTS.closingNew : WEIGHTS.closingKnew,
        topicSource: "inferred",
        milestones: [],
        engagedNow: false,
      };
    }
    default:
      return none;
  }
}

export function topicKey(kind: TopicKind, id: string): string {
  return `${kind}:${id}`;
}

export function classifyStoryHeuristic(
  story: RankableStory,
  catalog: InterestCatalogItem[],
): StoryTopic[] {
  const topics: StoryTopic[] = [
    { topicKey: topicKey("section", story.section), kind: "section", weight: 1000 },
  ];
  if (story.series) topics.push({ topicKey: topicKey("series", story.series), kind: "series", weight: 900 });
  if (story.format) topics.push({ topicKey: topicKey("format", story.format), kind: "format", weight: 400 });

  const haystack = `${story.section} ${story.title} ${story.excerpt ?? ""} ${(story.keywords ?? []).join(" ")}`.toLowerCase();
  for (const interest of catalog) {
    const hits = interest.contentKeys.filter((key) => haystack.includes(key.toLowerCase()));
    if (hits.length) {
      topics.push({
        topicKey: topicKey("interest", interest.id),
        kind: "interest",
        weight: Math.min(1000, 280 * hits.length),
      });
    }
  }
  for (const keyword of story.keywords ?? []) {
    const trimmed = keyword.trim();
    if (trimmed) topics.push({ topicKey: topicKey("keyword", trimmed.slice(0, 48)), kind: "keyword", weight: 250 });
  }
  return topics;
}

export function applySignalToScores(
  scores: TopicScore[],
  storyTopics: StoryTopic[],
  delta: number,
  source: TopicSource,
  nowIso: string,
  now = Date.parse(nowIso),
): TopicScore[] {
  if (!delta || storyTopics.length === 0) return scores;
  const byKey = new Map(scores.map((row) => [row.topicKey, { ...row }]));
  for (const topic of storyTopics) {
    const existing = byKey.get(topic.topicKey);
    const decayed = existing ? applyDecay(existing.weight, existing.updatedAt, now) : 0;
    const scaled = Math.round(delta * (topic.weight / 1000));
    const floor = existing?.source === "explicit" ? WEIGHTS.explicit : 0;
    const nextSource: TopicSource = existing?.source === "explicit" ? "explicit" : source;
    byKey.set(topic.topicKey, {
      topicKey: topic.topicKey,
      kind: topic.kind,
      source: nextSource,
      weight: Math.max(floor, decayed + scaled),
      updatedAt: nowIso,
    });
  }
  return [...byKey.values()];
}

export function decayedScores(scores: TopicScore[], now = Date.now()): TopicScore[] {
  return scores
    .map((row) => ({ ...row, weight: applyDecay(row.weight, row.updatedAt, now) }))
    .filter((row) => row.weight >= 8);
}

export function relatedness(candidate: RankableStory, current: RankableStory): number {
  let score = 0;
  if (candidate.series && candidate.series === current.series) score += 1;
  else if (candidate.section === current.section) score += 0.55;
  const currentKeys = new Set((current.keywords ?? []).map((key) => key.toLowerCase()));
  if (currentKeys.size) {
    const overlap = (candidate.keywords ?? []).filter((key) => currentKeys.has(key.toLowerCase())).length;
    score += Math.min(0.4, overlap * 0.12);
  }
  const titleBits = current.title.split(/\s+/).filter((word) => word.length > 3).slice(0, 6);
  const hay = `${candidate.title} ${candidate.excerpt ?? ""}`;
  const hits = titleBits.filter((word) => hay.includes(word)).length;
  score += Math.min(0.2, hits * 0.04);
  return score;
}

export function recencyScore(publishedAt: string | undefined, now = Date.now()): number {
  if (!publishedAt) return 0.2;
  const at = Date.parse(publishedAt);
  if (!Number.isFinite(at)) return 0.2;
  const days = (now - at) / 86_400_000;
  if (days < 0) return 0;
  if (days < 2) return 1;
  if (days < 7) return 0.8;
  if (days < 30) return 0.5;
  if (days < 90) return 0.3;
  return 0.15;
}

export function interestMatch(storyTopics: StoryTopic[], memberScores: TopicScore[]): number {
  if (!storyTopics.length || !memberScores.length) return 0;
  const weights = new Map(memberScores.map((row) => [row.topicKey, row.weight]));
  let total = 0;
  let matched = 0;
  for (const topic of storyTopics) {
    const memberWeight = weights.get(topic.topicKey) ?? 0;
    if (!memberWeight) continue;
    matched += 1;
    total += (memberWeight / 1000) * (topic.weight / 1000);
  }
  if (!matched) return 0;
  return Math.min(1.5, total);
}

export function likeAffinity(storyTopics: StoryTopic[], likedStoryTopics: StoryTopic[][]): number {
  if (!likedStoryTopics.length) return 0;
  const likedKeys = new Set(likedStoryTopics.flat().map((topic) => topic.topicKey));
  const hits = storyTopics.filter((topic) => likedKeys.has(topic.topicKey)).length;
  return Math.min(1, hits * 0.18);
}

type ReasonMaps = {
  interestLabels?: Record<string, string>;
  seriesNames?: Record<string, string>;
};

export function recommendationReason(
  item: RankableStory,
  current: RankableStory | null,
  memberScores: TopicScore[],
  maps: ReasonMaps = {},
): { code: string; text: string } {
  if (current?.series && item.series === current.series) {
    const name = maps.seriesNames?.[item.series] ?? item.series;
    return { code: "series", text: `لأنك تقرأ سلسلة «${name}»` };
  }

  const hay = `${item.section} ${item.title} ${item.excerpt ?? ""} ${(item.keywords ?? []).join(" ")}`.toLowerCase();
  const interestHits = memberScores
    .filter((row) => row.kind === "interest" && row.weight >= 200)
    .sort((a, b) => b.weight - a.weight);

  for (const row of interestHits) {
    const id = row.topicKey.slice("interest:".length);
    const label = maps.interestLabels?.[id] ?? id;
    if (item.section === id || hay.includes(id) || hay.includes(label.toLowerCase())) {
      if (row.source === "like") return { code: "like", text: `لأنك أعجبت بمواد عن ${label}` };
      return { code: "interest", text: `اهتمامك ب${label}` };
    }
  }

  if (current && (item.section === current.section || relatedness(item, current) >= 0.5)) {
    return { code: "related", text: "مرتبط بالمادة التي تقرؤها الآن" };
  }
  return { code: "editorial", text: "من اختيارات العلم" };
}

export function rankCandidates(input: {
  candidates: RankableStory[];
  current?: RankableStory | null;
  memberScores: TopicScore[];
  topicsByStory: Record<string, StoryTopic[]>;
  likedTopics?: StoryTopic[][];
  catalog?: InterestCatalogItem[];
  now?: number;
  seriesNames?: Record<string, string>;
}): RankedItem[] {
  const now = input.now ?? Date.now();
  const scores = decayedScores(input.memberScores, now);
  const current = input.current ?? null;
  const ranked: RankedItem[] = [];

  for (const candidate of input.candidates) {
    if (!isPubliclyRecommendable(candidate, now)) continue;
    if (current && candidate.id === current.id) continue;
    const topics = input.topicsByStory[candidate.id] ?? classifyStoryHeuristic(candidate, input.catalog ?? []);
    const rel = current ? relatedness(candidate, current) : 0;
    const interest = interestMatch(topics, scores);
    const recency = recencyScore(candidate.publishedAt, now);
    const likes = likeAffinity(topics, input.likedTopics ?? []);
    const score = current
      ? rel * 0.35 + interest * 0.3 + recency * 0.15 + likes * 0.1 + (candidate.format === current.format ? 0.05 : 0)
      : interest * 0.55 + recency * 0.25 + likes * 0.12 + (candidate.format === "news" ? 0.04 : 0.08);
    ranked.push({
      ...candidate,
      score,
      relatedness: rel,
      interest,
      recency,
      reason: recommendationReason(candidate, current, scores, {
        interestLabels: Object.fromEntries((input.catalog ?? []).map((item) => [item.id, item.label])),
        seriesNames: input.seriesNames,
      }),
    });
  }

  ranked.sort((a, b) => b.score - a.score || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return ranked;
}

export function diversityPass(
  ranked: RankedItem[],
  options: {
    limit?: number;
    recentlyReadIds?: Set<string>;
    currentSection?: string;
    discovery?: boolean;
  } = {},
): RankedItem[] {
  const limit = options.limit ?? 3;
  const recentlyRead = options.recentlyReadIds ?? new Set<string>();
  const picked: RankedItem[] = [];
  const sectionCount: Record<string, number> = {};
  const seriesCount: Record<string, number> = {};
  const skippedRead: RankedItem[] = [];

  for (const item of ranked) {
    if (picked.length >= limit) break;
    if (recentlyRead.has(item.id)) {
      skippedRead.push(item);
      continue;
    }
    if ((sectionCount[item.section] ?? 0) >= 2) continue;
    if (item.series && (seriesCount[item.series] ?? 0) >= 2) continue;
    const last = picked[picked.length - 1];
    if (last && last.section === item.section && last.series && last.series === item.series) continue;
    picked.push(item);
    sectionCount[item.section] = (sectionCount[item.section] ?? 0) + 1;
    if (item.series) seriesCount[item.series] = (seriesCount[item.series] ?? 0) + 1;
  }

  if (picked.length < limit) {
    for (const item of skippedRead) {
      if (picked.length >= limit) break;
      if (picked.some((row) => row.id === item.id)) continue;
      picked.push(item);
    }
  }

  if (options.discovery !== false && picked.length === limit) {
    const used = new Set(picked.map((item) => item.id));
    const discovery = ranked.find((item) => {
      if (used.has(item.id) || recentlyRead.has(item.id)) return false;
      if (options.currentSection && item.section === options.currentSection) return false;
      return (sectionCount[item.section] ?? 0) < 2;
    });
    if (discovery) {
      picked[limit - 1] = {
        ...discovery,
        reason: { code: "discovery", text: "موضوع مجاور قد يهمك" },
      };
    }
  }

  return picked.slice(0, limit);
}

export function recentlyReadIds(
  stats: Array<{ storyId: string; activeMs: number; maxProgress: number; lastVisitAt: string }>,
  now = Date.now(),
  windowMs = 6 * 60 * 60 * 1000,
): Set<string> {
  const ids = new Set<string>();
  for (const row of stats) {
    const at = Date.parse(row.lastVisitAt);
    const fresh = Number.isFinite(at) && now - at < windowMs;
    const deep = row.activeMs >= ENGAGED_MS || row.maxProgress >= 75;
    if (fresh && deep) ids.add(row.storyId);
  }
  return ids;
}

export function weaklySkippedIds(
  stats: Array<{ storyId: string; activeMs: number; maxProgress: number; liked: number; visits: number }>,
): Set<string> {
  const ids = new Set<string>();
  for (const row of stats) {
    if (row.liked) continue;
    if (row.visits >= 1 && row.activeMs < 5_000 && row.maxProgress < 15) ids.add(row.storyId);
  }
  return ids;
}
