import { eq } from "drizzle-orm";

import { memberLikes, memberProfiles, memberStoryStats } from "@/db/schema";
import { getDb } from "@/lib/db";
import { seedContentProvider, sectionName } from "@/lib/content/provider";
import { ALL_SERIES } from "@/lib/content/series";
import { storyHref, type Story } from "@/lib/content/types";
import { MEMBER_INTERESTS } from "@/lib/membership/interests";
import { loadMemberScores } from "./interests";
import { loadStoryTopicsMany } from "./classify";
import {
  classifyStoryHeuristic,
  diversityPass,
  rankCandidates,
  recentlyReadIds,
  weaklySkippedIds,
  type RankableStory,
  type StoryTopic,
} from "./math";

export type RelatedCard = {
  id: string;
  href: string;
  title: string;
  excerpt: string;
  sectionLabel: string;
  image?: string;
  readingMinutes: number;
  reason?: { code: string; text: string };
};

const SERIES_NAMES = Object.fromEntries(ALL_SERIES.map((item) => [item.slug, item.name]));

export function toRelatedCard(story: Story, reason?: { code: string; text: string }): RelatedCard {
  return {
    id: story.id,
    href: storyHref(story),
    title: story.title,
    excerpt: story.excerpt,
    sectionLabel: sectionName(story.section),
    image: story.image,
    readingMinutes: story.readingMinutes,
    reason,
  };
}

function asRankable(story: Story): RankableStory {
  return {
    id: story.id,
    section: story.section,
    series: story.series,
    format: story.format,
    title: story.title,
    excerpt: story.excerpt,
    keywords: story.keywords,
    publishedAt: story.publishedAt,
  };
}

async function topicsMap(stories: Story[]): Promise<Record<string, StoryTopic[]>> {
  const slice = stories.slice(0, 48);
  const stored = await loadStoryTopicsMany(slice.map((story) => story.id));
  const map: Record<string, StoryTopic[]> = {};
  for (const story of slice) {
    map[story.id] = stored[story.id]?.length
      ? stored[story.id]
      : classifyStoryHeuristic(asRankable(story), MEMBER_INTERESTS);
  }
  return map;
}

async function memberContext(memberId: string) {
  const db = getDb();
  const scores = await loadMemberScores(memberId);
  if (!db) {
    return { scores, readIds: new Set<string>(), skipIds: new Set<string>(), likedTopics: [] as StoryTopic[][], enabled: true };
  }
  const [stats, likes, profile] = await Promise.all([
    db.select().from(memberStoryStats).where(eq(memberStoryStats.memberId, memberId)),
    db.select({ storyId: memberLikes.storyId }).from(memberLikes).where(eq(memberLikes.memberId, memberId)),
    db.select({ enabled: memberProfiles.personalizationEnabled }).from(memberProfiles).where(eq(memberProfiles.authUserId, memberId)).limit(1),
  ]);
  const likedIds = likes.slice(0, 12).map((row) => row.storyId);
  const likedStored = await loadStoryTopicsMany(likedIds);
  const likedTopics: StoryTopic[][] = likedIds
    .map((id) => likedStored[id] ?? [])
    .filter((topics) => topics.length > 0);
  return {
    scores,
    readIds: recentlyReadIds(stats),
    skipIds: weaklySkippedIds(stats),
    likedTopics,
    enabled: profile[0]?.enabled !== 0,
  };
}

export async function relatedForVisitor(story: Story, limit = 3): Promise<RelatedCard[]> {
  const related = await seedContentProvider.listRelated(story, limit);
  return related.map((item) => toRelatedCard(item, { code: "related", text: "مرتبط بالمادة التي تقرؤها الآن" }));
}

export async function relatedForMember(memberId: string, storyId: string, limit = 3): Promise<RelatedCard[]> {
  const current = await seedContentProvider.getStory(storyId);
  if (!current) return [];
  try {
    const ctx = await memberContext(memberId);
    if (!ctx.enabled) return relatedForVisitor(current, limit);

    const all = await seedContentProvider.listAll();
    const pool = all.filter((item) => item.id !== current.id);
    const topicsByStory = await topicsMap([current, ...pool.slice(0, 40)]);
    const ranked = rankCandidates({
      candidates: pool.map(asRankable),
      current: asRankable(current),
      memberScores: ctx.scores,
      topicsByStory,
      likedTopics: ctx.likedTopics,
      catalog: MEMBER_INTERESTS,
      seriesNames: SERIES_NAMES,
    });
    const skip = new Set([...ctx.readIds, ...ctx.skipIds]);
    const picked = diversityPass(ranked, {
      limit,
      recentlyReadIds: skip,
      currentSection: current.section,
      discovery: true,
    });
    const byId = new Map(all.map((item) => [item.id, item]));
    const cards = picked
      .map((item) => {
        const story = byId.get(item.id);
        return story ? toRelatedCard(story, item.reason) : null;
      })
      .filter((item): item is RelatedCard => Boolean(item));
    return cards.length ? cards : relatedForVisitor(current, limit);
  } catch {
    return relatedForVisitor(current, limit);
  }
}

export async function forYouForMember(memberId: string, limit = 9): Promise<RelatedCard[]> {
  try {
    const ctx = await memberContext(memberId);
    const all = await seedContentProvider.listAll();
    const topicsByStory = await topicsMap(all.slice(0, 48));
    const ranked = rankCandidates({
      candidates: all.map(asRankable),
      memberScores: ctx.enabled ? ctx.scores : ctx.scores.filter((row) => row.source === "explicit"),
      topicsByStory,
      likedTopics: ctx.enabled ? ctx.likedTopics : [],
      catalog: MEMBER_INTERESTS,
      seriesNames: SERIES_NAMES,
    });
    const picked = diversityPass(ranked, {
      limit,
      recentlyReadIds: ctx.enabled ? ctx.readIds : new Set(),
      discovery: true,
    });
    const byId = new Map(all.map((item) => [item.id, item]));
    return picked
      .map((item) => {
        const story = byId.get(item.id);
        return story ? toRelatedCard(story, item.reason) : null;
      })
      .filter((item): item is RelatedCard => Boolean(item));
  } catch {
    const all = await seedContentProvider.listAll();
    return all.slice(0, limit).map((story) => toRelatedCard(story));
  }
}
