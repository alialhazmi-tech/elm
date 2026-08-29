import { eq, sql } from "drizzle-orm";

import { memberEvents, memberLikes, memberStoryStats } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * مؤشرات المادة المجمّعة — من قراءات الأعضاء فقط، بلا بيانات فردية.
 * تغذّي بطاقات «مؤشرات المادة» في جانب المقال.
 */
export interface StoryInsights {
  /** عدد الأعضاء الذين فتحوا المادة. */
  readers: number;
  /** متوسط زمن القراءة الفعلي بالدقائق (عُشر دقيقة). */
  avgMinutes: number;
  /** توزيع زمن القراءة: أقل من 2، 2–4، 4–6، أكثر من 6 دقائق — نسب مئوية. */
  timeBuckets: [number, number, number, number];
  /** نسبة من تجاوزوا 25% / 50% / 90% من المادة. */
  reach: { intro: number; body: number; end: number };
  /** نسبة الإكمال (تجاوز 90%). */
  completion: number;
  likes: number;
  /** إجابات سؤال الختام. */
  answers: number;
  /** نسبة من تفاعلوا (إعجاب أو إجابة أو أداة ذكاء) من القرّاء. */
  engagement: number;
  /** تفاعلات كل يوم خلال آخر 30 يومًا (الأقدم أولًا). */
  daily: number[];
  /** تغيّر التفاعل: آخر 7 أيام مقابل السبعة قبلها — نسبة مئوية. */
  trend: number;
}

export const EMPTY_INSIGHTS: StoryInsights = {
  readers: 0,
  avgMinutes: 0,
  timeBuckets: [0, 0, 0, 0],
  reach: { intro: 0, body: 0, end: 0 },
  completion: 0,
  likes: 0,
  answers: 0,
  engagement: 0,
  daily: Array.from({ length: 30 }, () => 0),
  trend: 0,
};

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export async function storyInsights(storyId: string): Promise<StoryInsights> {
  const db = getDb();
  if (!db || !storyId) return EMPTY_INSIGHTS;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [[agg], [likeRow], dayRows] = await Promise.all([
    db
      .select({
        readers: sql<number>`count(*)::int`,
        avgMs: sql<number>`coalesce(avg(${memberStoryStats.activeMs}), 0)::float`,
        t1: sql<number>`count(*) filter (where ${memberStoryStats.activeMs} < 120000)::int`,
        t2: sql<number>`count(*) filter (where ${memberStoryStats.activeMs} >= 120000 and ${memberStoryStats.activeMs} < 240000)::int`,
        t3: sql<number>`count(*) filter (where ${memberStoryStats.activeMs} >= 240000 and ${memberStoryStats.activeMs} < 360000)::int`,
        t4: sql<number>`count(*) filter (where ${memberStoryStats.activeMs} >= 360000)::int`,
        intro: sql<number>`count(*) filter (where ${memberStoryStats.maxProgress} >= 25)::int`,
        body: sql<number>`count(*) filter (where ${memberStoryStats.maxProgress} >= 50)::int`,
        end: sql<number>`count(*) filter (where ${memberStoryStats.maxProgress} >= 90)::int`,
        answers: sql<number>`count(*) filter (where ${memberStoryStats.closingAnswer} is not null)::int`,
        engaged: sql<number>`count(*) filter (where ${memberStoryStats.liked} = 1 or ${memberStoryStats.usedAi} = 1 or ${memberStoryStats.closingAnswer} is not null)::int`,
      })
      .from(memberStoryStats)
      .where(eq(memberStoryStats.storyId, storyId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(memberLikes)
      .where(eq(memberLikes.storyId, storyId)),
    db
      .select({
        day: sql<string>`substr(${memberEvents.createdAt}, 1, 10)`,
        n: sql<number>`count(*)::int`,
      })
      .from(memberEvents)
      .where(
        sql`${memberEvents.storyId} = ${storyId} and ${memberEvents.createdAt} >= ${since} and ${memberEvents.type} in ('like', 'closing_answer', 'ai_discuss', 'ai_summary', 'ai_simplify', 'listen')`,
      )
      .groupBy(sql`substr(${memberEvents.createdAt}, 1, 10)`),
  ]);

  const byDay = new Map(dayRows.map((row) => [row.day, Number(row.n)]));
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    return byDay.get(day) ?? 0;
  });
  const last7 = daily.slice(23).reduce((a, b) => a + b, 0);
  const prev7 = daily.slice(16, 23).reduce((a, b) => a + b, 0);
  const trend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : last7 > 0 ? 100 : 0;

  const readers = Number(agg?.readers ?? 0);
  if (readers === 0) return { ...EMPTY_INSIGHTS, likes: Number(likeRow?.n ?? 0), daily, trend };

  return {
    readers,
    avgMinutes: Math.round((Number(agg.avgMs) / 60000) * 10) / 10,
    timeBuckets: [pct(agg.t1, readers), pct(agg.t2, readers), pct(agg.t3, readers), pct(agg.t4, readers)],
    reach: { intro: pct(agg.intro, readers), body: pct(agg.body, readers), end: pct(agg.end, readers) },
    completion: pct(agg.end, readers),
    likes: Number(likeRow?.n ?? 0),
    answers: Number(agg.answers),
    engagement: pct(agg.engaged, readers),
    daily,
    trend,
  };
}
