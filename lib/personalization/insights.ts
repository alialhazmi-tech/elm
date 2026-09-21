import { eq, sql } from "drizzle-orm";

import { memberEvents, memberLikes, memberStoryStats, storyReadingSessions, visitorStoryInteractions } from "@/db/schema";
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
  /** نسبة من تفاعلوا (إعجاب أو إجابة سؤال الختام) من القرّاء. */
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
  if (!db) throw new Error("INSIGHTS_UNAVAILABLE");
  if (!storyId) return EMPTY_INSIGHTS;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [readingRows, [likeRow], dayRows, [answerRow], visitorRows] = await Promise.all([
    db.execute<{
      readers: number; avgMs: number; t1: number; t2: number; t3: number; t4: number;
      intro: number; body: number; end: number; engaged: number;
    }>(sql`
      with readers as (
        select r.visitor_id, sum(r.active_ms) as active_ms, max(r.max_progress) as progress,
          bool_or(coalesce(m.closing_answer is not null, false)
            or exists (select 1 from member_likes l where l.member_id = r.member_id and l.story_id = r.story_id)
            or exists (select 1 from visitor_story_interactions v where v.visitor_id = r.visitor_id and v.story_id = r.story_id and (v.liked = 1 or v.closing_answer is not null))) as engaged
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
    db.execute<{ day: string; n: number }>(sql`
      with interactions as (
        select created_at as at from ${memberLikes} where story_id = ${storyId}
        union all
        select (select min(e.created_at) from ${memberEvents} e where e.member_id = m.member_id and e.story_id = m.story_id and e.type = 'closing_answer') as at
        from ${memberStoryStats} m where m.story_id = ${storyId} and m.closing_answer is not null
        union all
        select liked_at as at from ${visitorStoryInteractions} where story_id = ${storyId} and liked = 1
        union all
        select answered_at as at from ${visitorStoryInteractions} where story_id = ${storyId} and closing_answer is not null
      ) select substr(at, 1, 10) as day, count(*)::int as n from interactions where at >= ${since} group by substr(at, 1, 10)
    `),
    db.select({ n: sql<number>`count(*)::int` }).from(memberStoryStats)
      .where(sql`${memberStoryStats.storyId} = ${storyId} and ${memberStoryStats.closingAnswer} is not null`),
    db.execute<{ likes: number; answers: number }>(sql`select count(*) filter (where liked = 1)::int as likes, count(*) filter (where closing_answer is not null)::int as answers from ${visitorStoryInteractions} where story_id = ${storyId}`),
  ]);
  const likes = Number(likeRow?.n ?? 0) + Number(visitorRows.rows[0]?.likes ?? 0);
  const answers = Number(answerRow?.n ?? 0) + Number(visitorRows.rows[0]?.answers ?? 0);
  const agg = readingRows.rows[0];

  const byDay = new Map(dayRows.rows.map((row) => [row.day, Number(row.n)]));
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    return byDay.get(day) ?? 0;
  });
  const last7 = daily.slice(23).reduce((a, b) => a + b, 0);
  const prev7 = daily.slice(16, 23).reduce((a, b) => a + b, 0);
  const trend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : 0;

  const readers = Number(agg?.readers ?? 0);
  if (readers === 0) return { ...EMPTY_INSIGHTS, likes, answers, daily, trend };

  return {
    readers,
    avgMinutes: Math.round((Number(agg.avgMs) / 60000) * 10) / 10,
    timeBuckets: [pct(agg.t1, readers), pct(agg.t2, readers), pct(agg.t3, readers), pct(agg.t4, readers)],
    reach: { intro: pct(agg.intro, readers), body: pct(agg.body, readers), end: pct(agg.end, readers) },
    completion: pct(agg.end, readers),
    likes,
    answers,
    engagement: pct(agg.engaged, readers),
    daily,
    trend,
  };
}
