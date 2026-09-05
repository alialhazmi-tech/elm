import { and, eq, isNotNull, sql } from "drizzle-orm";

import { memberStoryStats, visitorStoryInteractions } from "@/db/schema";
import { getDb } from "@/lib/db";
import { seedContentProvider } from "@/lib/content/provider";

/** عدّ إجابات الختام من الأعضاء والزوار، من الحفظ المؤكد في قاعدة البيانات. */
export async function closingAnswerCounts(storyId: string): Promise<[number, number]> {
  const counts: [number, number] = [0, 0];
  const db = getDb();
  if (!db) throw new Error("INTERACTIONS_UNAVAILABLE");
  if (!storyId) return counts;
  const story = await seedContentProvider.getStory(storyId);
  if (!story) return counts;

  const rows = await db
    .select({
      answer: memberStoryStats.closingAnswer,
      n: sql<number>`count(*)::int`,
    })
    .from(memberStoryStats)
    .where(and(eq(memberStoryStats.storyId, storyId), isNotNull(memberStoryStats.closingAnswer)))
    .groupBy(memberStoryStats.closingAnswer);

  for (const row of rows) {
    if (row.answer === 0 || row.answer === 1) counts[row.answer] = Number(row.n ?? 0);
  }
  const visitors = await db.select({ answer: visitorStoryInteractions.closingAnswer, n: sql<number>`count(*)::int` })
    .from(visitorStoryInteractions).where(eq(visitorStoryInteractions.storyId, storyId)).groupBy(visitorStoryInteractions.closingAnswer);
  for (const row of visitors) if (row.answer === 0 || row.answer === 1) counts[row.answer] += Number(row.n);
  return counts;
}
