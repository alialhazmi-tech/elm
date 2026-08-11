import Link from "next/link";

import { SERIES } from "@/lib/content/series";
import { runPolicyGuard } from "@/lib/policy";
import { getSession } from "@/lib/tahrir/auth";
import {
  bodiesFor,
  listLatestByStatus,
  publishedTodayCount,
  seriesDistribution,
  statusCounts,
} from "@/lib/tahrir/service";

export const metadata = { title: "نظرة اليوم" };
export const dynamic = "force-dynamic";

function guardChip(title: string, body: string) {
  const report = runPolicyGuard({ title, body });
  if (report.counts.blocking > 0)
    return { cls: "block", label: `${report.counts.blocking} قاطع` };
  if (report.counts.warning > 0) return { cls: "warn", label: `${report.counts.warning} تحذير` };
  return { cls: "ok", label: "سليم" };
}

export default async function OverviewPage() {
  const session = await getSession();
  const [counts, todayCount, review, latestPublished, distribution] = await Promise.all([
    statusCounts().catch(() => ({}) as Record<string, number>),
    publishedTodayCount().catch(() => 0),
    listLatestByStatus("review", 5).catch(() => []),
    listLatestByStatus("published", 3).catch(() => []),
    seriesDistribution().catch(() => []),
  ]);
  const reviewBodies = await bodiesFor(review.map((row) => row.id));

  const totalsBySlug = new Map(distribution.map((row) => [row.seriesSlug, row.total]));
  const seriesCounts = SERIES.map((series) => ({
    ...series,
    count: totalsBySlug.get(series.slug) ?? 0,
  }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const maxCount = Math.max(1, ...seriesCounts.map((series) => series.count));
  const totalStories = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <main className="th-screen">
      <div className="th-hello">
        <h1>صباح المعرفة يا {session?.displayName.split(" ")[0]}</h1>
        <span className="d">
          {todayCount > 0 ? `${todayCount} مواد نُشرت اليوم` : "لم يُنشر شيء بعد اليوم"}
        </span>
      </div>

      <div className="th-tiles">
        <div className="th-tile">
          <div className="lb">منشور اليوم</div>
          <div className="v">{todayCount}</div>
          <div className="tr">من أصل {counts.published ?? 0} منشورة</div>
        </div>
        <div className="th-tile">
          <div className="lb">بانتظار الاعتماد</div>
          <div className="v">{counts.review ?? 0}</div>
          <div className="tr">{(counts.review ?? 0) > 0 ? "تحتاج قرار معتمد" : "القائمة فارغة"}</div>
        </div>
        <div className="th-tile">
          <div className="lb">مسودات نشطة</div>
          <div className="v">{counts.draft ?? 0}</div>
          <div className="tr">تحرير جارٍ</div>
        </div>
        <div className="th-tile">
          <div className="lb">إجمالي المواد</div>
          <div className="v">{totalStories}</div>
          <div className="tr">عبر {SERIES.length} سلاسل</div>
        </div>
      </div>

      <div className="th-cols">
        <div className="th-panel">
          <div className="hd">
            <h2>بانتظار الاعتماد</h2>
            <Link className="mr" href="/tahrir/stories?status=review">
              كل القائمة ←
            </Link>
          </div>
          {review.length === 0 && <div className="th-empty">لا مواد بانتظار الاعتماد الآن.</div>}
          {review.map((story) => {
            const content = reviewBodies.get(story.id);
            const chip = content ? guardChip(content.title, content.body) : { cls: "ok", label: "—" };
            return (
              <Link key={story.id} className="th-qrow" href={`/tahrir/editor/${story.id}`}>
                <span className={`th-gchip ${chip.cls}`}>{chip.label}</span>
                <span className="t">{story.title}</span>
                <span className="who">{story.authorName || "—"}</span>
              </Link>
            );
          })}
          <div className="hd" style={{ borderTop: "1px solid var(--t-line)" }}>
            <h2>آخر ما نُشر</h2>
          </div>
          {latestPublished.map((story) => (
            <Link key={story.id} className="th-qrow" href={`/tahrir/editor/${story.id}`}>
              <span className="th-gchip ok">منشور</span>
              <span className="t">{story.title}</span>
              <span className="who">{(story.publishedAt ?? "").slice(0, 10)}</span>
            </Link>
          ))}
        </div>

        <div className="th-panel">
          <div className="hd">
            <h2>السلاسل — توزيع المواد</h2>
          </div>
          <div className="th-serbars">
            {seriesCounts.map((series) => (
              <div className="th-serb" key={series.slug} style={{ "--sc": series.color } as React.CSSProperties}>
                <span>{series.name}</span>
                <span className="bar">
                  <i style={{ width: `${(series.count / maxCount) * 100}%` }} />
                </span>
                <b>{series.count}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
