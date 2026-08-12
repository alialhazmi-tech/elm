import { and, eq } from "drizzle-orm";

import { memberEvents, memberLikes, memberProfiles, memberStoryStats } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
  applyEvent,
  clampDuration,
  emptyStats,
  sanitizeEventBatch,
  type EventType,
  type IncomingEvent,
  type StoryStats,
} from "./math";
import { applyStorySignal } from "./interests";
import { ensureStoryTopics } from "./classify";

function rowToStats(row: {
  activeMs: number;
  maxProgress: number;
  visits: number;
  lastVisitAt: string;
  liked: number;
  usedAi: number;
  aiTools: unknown;
  closingAnswer: number | null;
  interestScore: number;
}): StoryStats {
  return {
    activeMs: row.activeMs,
    maxProgress: row.maxProgress,
    visits: row.visits,
    lastVisitAt: row.lastVisitAt,
    liked: row.liked,
    usedAi: row.usedAi,
    aiTools: Array.isArray(row.aiTools) ? (row.aiTools as string[]) : [],
    closingAnswer: row.closingAnswer,
    interestScore: row.interestScore,
  };
}

async function personalizationOn(memberId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return true;
  const rows = await db
    .select({ enabled: memberProfiles.personalizationEnabled })
    .from(memberProfiles)
    .where(eq(memberProfiles.authUserId, memberId))
    .limit(1);
  return rows[0]?.enabled !== 0;
}

export async function persistStatsAndSignal(
  memberId: string,
  storyId: string,
  type: EventType,
  nowIso: string,
  extra: { value?: number | null; durationMs?: number | null } = {},
): Promise<StoryStats | null> {
  return recordMemberEvents(memberId, [
    { type, storyId, value: extra.value ?? null, durationMs: extra.durationMs ?? null },
  ], nowIso).then((result) => result.statsByStory[storyId] ?? null);
}

export async function recordMemberEvents(
  memberId: string,
  rawEvents: unknown,
  nowIso = new Date().toISOString(),
): Promise<{ accepted: number; statsByStory: Record<string, StoryStats> }> {
  const db = getDb();
  const enabled = await personalizationOn(memberId);
  const inferred = new Set<IncomingEvent["type"]>([
    "article_open",
    "reading_progress",
    "engaged_read",
    "ai_summary",
    "ai_simplify",
    "ai_discuss",
    "listen",
    "related_click",
  ]);
  const events = sanitizeEventBatch(rawEvents).filter((event) => enabled || !inferred.has(event.type));
  if (!db || events.length === 0) return { accepted: 0, statsByStory: {} };
  const statsByStory: Record<string, StoryStats> = {};
  let accepted = 0;

  const grouped = new Map<string, IncomingEvent[]>();
  for (const event of events) {
    const list = grouped.get(event.storyId) ?? [];
    list.push(event);
    grouped.set(event.storyId, list);
  }

  for (const [storyId, storyEvents] of grouped) {
    const existing = await db
      .select()
      .from(memberStoryStats)
      .where(and(eq(memberStoryStats.memberId, memberId), eq(memberStoryStats.storyId, storyId)))
      .limit(1);
    let stats = existing[0] ? rowToStats(existing[0]) : emptyStats(nowIso);

    for (const event of storyEvents) {
      const result = applyEvent(stats, event, nowIso);
      stats = result.stats;
      accepted += 1;

      if (event.type === "like") {
        await db.insert(memberLikes).values({ memberId, storyId, createdAt: nowIso }).onConflictDoNothing();
      } else if (event.type === "unlike") {
        await db.delete(memberLikes).where(and(eq(memberLikes.memberId, memberId), eq(memberLikes.storyId, storyId)));
      }

      if (result.persistEvent) {
        await db.insert(memberEvents).values({
          id: crypto.randomUUID(),
          memberId,
          storyId,
          type: event.type,
          value: event.type === "reading_progress" ? stats.maxProgress : (event.value ?? null),
          durationMs: event.durationMs != null ? clampDuration(event.durationMs) : null,
          createdAt: nowIso,
        });
      }

      if (result.engagedNow) {
        await db.insert(memberEvents).values({
          id: crypto.randomUUID(),
          memberId,
          storyId,
          type: "engaged_read",
          value: stats.maxProgress,
          durationMs: stats.activeMs,
          createdAt: nowIso,
        }).catch(() => undefined);
      }

      if (enabled && result.topicDelta && result.topicSource) {
        await applyStorySignal(memberId, storyId, result.topicDelta, result.topicSource, nowIso);
      }
    }

    await db
      .insert(memberStoryStats)
      .values({
        memberId,
        storyId,
        activeMs: stats.activeMs,
        maxProgress: stats.maxProgress,
        visits: stats.visits,
        lastVisitAt: stats.lastVisitAt,
        liked: stats.liked,
        usedAi: stats.usedAi,
        aiTools: stats.aiTools,
        closingAnswer: stats.closingAnswer,
        interestScore: stats.interestScore,
        updatedAt: nowIso,
      })
      .onConflictDoUpdate({
        target: [memberStoryStats.memberId, memberStoryStats.storyId],
        set: {
          activeMs: stats.activeMs,
          maxProgress: stats.maxProgress,
          visits: stats.visits,
          lastVisitAt: stats.lastVisitAt,
          liked: stats.liked,
          usedAi: stats.usedAi,
          aiTools: stats.aiTools,
          closingAnswer: stats.closingAnswer,
          interestScore: stats.interestScore,
          updatedAt: nowIso,
        },
      });

    statsByStory[storyId] = stats;
    void ensureStoryTopics(storyId);
  }

  return { accepted, statsByStory };
}
