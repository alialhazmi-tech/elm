import Link from "next/link";

import { SERIES } from "@/lib/content/series";
import { runPolicyGuard } from "@/lib/policy";
import { getSession } from "@/lib/tahrir/auth";
import { listForDashboard, type StoryRow } from "@/lib/tahrir/service";

export const metadata = { title: "نظرة اليوم" };
export const dynamic = "force-dynamic";

function guardChip(story: StoryRow) {
  const report = runPolicyGuard({ id: story.id, title: story.title, body: story.body });
  if (report.counts.blocking > 0)
    return { cls: "block", label: `${report.counts.blocking} قاطع` };
  if (report.counts.warning > 0) return { cls: "warn", label: `${report.counts.warning} تحذير` };
  return { cls: "ok", label: "سليم" };
}

export default async function OverviewPage() {
  const session = await getSession();
  const rows = await listForDashboard().catch(() => []);

  const todayIso = new Date().toISOString().slice(0, 10);
  const publishedToday = rows.filter(
    (row) => row.status === "published" && (row.publishedAt ?? "").startsWith(todayIso),
  );
  const review = rows.filter((row) => row.status === "review");
  const drafts = rows.filter((row) => row.status === "draft");
  const latestPublished = rows.filter((row) => row.status === "published").slice(0, 3);

  const seriesCounts = SERIES.map((series) => ({
    ...series,
    count: rows.filter((row) => row.seriesSlug === series.slug).length,
  }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const maxCount = Math.max(1, ...seriesCounts.map((series) => series.count));

  return (
    <main className="th-screen">
      <div className="th-hello">
        <h1>صباح المعرفة يا {session?.displayName.split(" ")[0]}</h1>
        <span className="d">
          {publishedToday.length > 0
            ? `${publishedToday.length} مواد نُشرت اليوم`
            : "لم يُنشر شيء بعد اليوم"}
        </span>
      </div>

      <div className="th-tiles">
        <div className="th-tile">
          <div className="lb">منشور اليوم</div>
          <div className="v">{publishedToday.length}</div>
          <div className="tr">من أصل {rows.filter((r) => r.status === "published").length} منشورة</div>
        </div>
        <div className="th-tile">
          <div className="lb">بانتظار الاعتماد</div>
          <div className="v">{review.length}</div>
          <div className="tr">{review.length > 0 ? "تحتاج قرار معتمد" : "القائمة فارغة"}</div>
        </div>
        <div className="th-tile">
          <div className="lb">مسودات نشطة</div>
          <div className="v">{drafts.length}</div>
          <div className="tr up">
            {drafts.filter((row) => guardChip(row).cls === "ok").length} سليمة من الحارس
          </div>
        </div>
        <div className="th-tile">
          <div className="lb">إجمالي المواد</div>
          <div className="v">{rows.length}</div>
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
          {review.slice(0, 5).map((story) => {
            const chip = guardChip(story);
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
