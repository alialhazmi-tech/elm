import { desc, eq, sql } from "drizzle-orm";

import { memberEvents, memberLikes, memberStoryStats, memberTopicScores } from "@/db/schema";
import { getDb } from "@/lib/db";

/** مقاييس مجمّعة بلا بيانات فردية — للوحة التحرير لاحقًا بعد اعتماد النموذج. */
export async function personalizationMetrics() {
  const db = getDb();
  if (!db) {
    return {
      membersWithLikes: 0,
      likeEvents: 0,
      avgActiveMs: 0,
      topEngaged: [] as Array<{ storyId: string; activeMs: number }>,
      relatedClicks: 0,
      growingTopics: [] as Array<{ topicKey: string; weight: number }>,
      aiToolUses: 0,
    };
  }

  const [likes, avg, engaged, clicks, topics, ai] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(memberLikes),
    db.select({ avg: sql<number>`coalesce(avg(${memberStoryStats.activeMs}), 0)` }).from(memberStoryStats),
    db
      .select({
        storyId: memberStoryStats.storyId,
        activeMs: sql<number>`sum(${memberStoryStats.activeMs})`,
      })
      .from(memberStoryStats)
      .groupBy(memberStoryStats.storyId)
      .orderBy(desc(sql`sum(${memberStoryStats.activeMs})`))
      .limit(8),
    db.select({ n: sql<number>`count(*)` }).from(memberEvents).where(eq(memberEvents.type, "related_click")),
    db
      .select({
        topicKey: memberTopicScores.topicKey,
        weight: sql<number>`sum(${memberTopicScores.weight})`,
      })
      .from(memberTopicScores)
      .groupBy(memberTopicScores.topicKey)
      .orderBy(desc(sql`sum(${memberTopicScores.weight})`))
      .limit(8),
    db
      .select({ n: sql<number>`count(*)` })
      .from(memberEvents)
      .where(sql`${memberEvents.type} in ('ai_summary','ai_simplify','ai_discuss','listen')`),
  ]);

  return {
    membersWithLikes: Number(likes[0]?.n ?? 0),
    likeEvents: Number(likes[0]?.n ?? 0),
    avgActiveMs: Number(avg[0]?.avg ?? 0),
    topEngaged: engaged.map((row) => ({ storyId: row.storyId, activeMs: Number(row.activeMs ?? 0) })),
    relatedClicks: Number(clicks[0]?.n ?? 0),
    growingTopics: topics.map((row) => ({ topicKey: row.topicKey, weight: Number(row.weight ?? 0) })),
    aiToolUses: Number(ai[0]?.n ?? 0),
  };
}
