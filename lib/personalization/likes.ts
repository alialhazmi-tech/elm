import { and, eq } from "drizzle-orm";

import { memberLikes, memberStoryStats } from "@/db/schema";
import { getDb } from "@/lib/db";
import { emptyStats, type StoryStats } from "./math";
import { persistStatsAndSignal } from "./events";

export async function getLiked(memberId: string, storyId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const rows = await db
    .select({ storyId: memberLikes.storyId })
    .from(memberLikes)
    .where(and(eq(memberLikes.memberId, memberId), eq(memberLikes.storyId, storyId)))
    .limit(1);
  return rows.length > 0;
}

export async function setLiked(memberId: string, storyId: string, liked: boolean): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("MEMBERSHIP_DATABASE_UNAVAILABLE");
  const now = new Date().toISOString();

  if (liked) {
    await db
      .insert(memberLikes)
      .values({ memberId, storyId, createdAt: now })
      .onConflictDoNothing();
  } else {
    await db
      .delete(memberLikes)
      .where(and(eq(memberLikes.memberId, memberId), eq(memberLikes.storyId, storyId)));
  }

  await persistStatsAndSignal(memberId, storyId, liked ? "like" : "unlike", now);
  return liked;
}

export async function loadStats(memberId: string, storyId: string): Promise<StoryStats | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(memberStoryStats)
    .where(and(eq(memberStoryStats.memberId, memberId), eq(memberStoryStats.storyId, storyId)))
    .limit(1);
  const row = rows[0];
  if (!row) return emptyStats();
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
