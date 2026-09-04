import { eq, sql } from "drizzle-orm";

import { memberEvents, memberLikes, memberStoryStats, storyReadingSessions } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * مؤشرات المادة المجمّعة — من قراءات جميع الزوار، بلا بيانات فردية.
 * تغذّي بطاقات «مؤشرات المادة» في جانب المقال.
 */
export interface StoryInsights {
  /** عدد المتصفحات المميزة التي فتحت المادة منذ تفعيل القياس العام. */
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
  const [readingRows, [likeRow], dayRows, [answerRow]] = await Promise.all([
    db.execute<{
      readers: number; avgMs: number; t1: number; t2: number; t3: number; t4: number;
      intro: number; body: number; end: number; engaged: number;
    }>(sql`
      with readers as (
        select r.visitor_id, sum(r.active_ms) as active_ms, max(r.max_progress) as progress,
          bool_or(coalesce(m.liked = 1 or m.used_ai = 1 or m.closing_answer is not null, false)) as engaged
        from ${storyReadingSessions} r
        left join ${memberStoryStats} m on m.member_id = r.member_id and m.story_id = r.story_id
        where r.story_id = ${storyId}
        group by r.visitor_id
      )
      select count(*)::int as readers, coalesce(avg(active_ms), 0)::float as "avgMs",
        count(*) filter (where active_ms < 120000)::int as t1,
        count(*) filter (where active_ms >= 120000 and active_ms < 240000)::int as t2,
        count(*) filter (where active_ms >= 240000 and active_ms < 360000)::int as t3,
        count(*) filter (where active_ms >= 360000)::int as t4,
        count(*) filter (where progress >= 25)::int as intro,
        count(*) filter (where progress >= 50)::int as body,
        count(*) filter (where progress >= 90)::int as end,
        count(*) filter (where engaged)::int as engaged
      from readers
    `),
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
    db.select({ n: sql<number>`count(*)::int` }).from(memberStoryStats)
      .where(sql`${memberStoryStats.storyId} = ${storyId} and ${memberStoryStats.closingAnswer} is not null`),
  ]);
  const agg = readingRows.rows[0];

  const byDay = new Map(dayRows.map((row) => [row.day, Number(row.n)]));
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    return byDay.get(day) ?? 0;
  });
  const last7 = daily.slice(23).reduce((a, b) => a + b, 0);
  const prev7 = daily.slice(16, 23).reduce((a, b) => a + b, 0);
  const trend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : last7 > 0 ? 100 : 0;

  const readers = Number(agg?.readers ?? 0);
  if (readers === 0) return { ...EMPTY_INSIGHTS, likes: Number(likeRow?.n ?? 0), answers: Number(answerRow?.n ?? 0), daily, trend };

  return {
    readers,
    avgMinutes: Math.round((Number(agg.avgMs) / 60000) * 10) / 10,
    timeBuckets: [pct(agg.t1, readers), pct(agg.t2, readers), pct(agg.t3, readers), pct(agg.t4, readers)],
    reach: { intro: pct(agg.intro, readers), body: pct(agg.body, readers), end: pct(agg.end, readers) },
    completion: pct(agg.end, readers),
    likes: Number(likeRow?.n ?? 0),
    answers: Number(answerRow?.n ?? 0),
    engagement: pct(agg.engaged, readers),
    daily,
    trend,
  };
}
