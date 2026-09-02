import Link from "next/link";

import { GuardChip, SeriesTag, StatusPill } from "@/components/tahrir/badges";
import { Panel, PanelEmpty, PanelHeader } from "@/components/tahrir/overview/panel";
import { StatTile } from "@/components/tahrir/overview/stat-tile";
import { TodayTimeline, type TimelineItem } from "@/components/tahrir/overview/today-timeline";
import { stripHtmlToText } from "@/lib/content/html";
import { SERIES } from "@/lib/content/series";
import { relativeTimeAr } from "@/lib/format";
import { runPolicyGuard } from "@/lib/policy";
import { loadActor } from "@/lib/tahrir/access";
import { editorHref } from "@/lib/tahrir/routes";
import {
  bodiesFor,
  listLatestByStatus,
  publishedPerDay,
  publishedTodayCount,
  seriesDistribution,
  statusCounts,
} from "@/lib/tahrir/service";

export const metadata = { title: "نظرة اليوم" };
export const dynamic = "force-dynamic";

const seriesBySlug = new Map<string, (typeof SERIES)[number]>(SERIES.map((series) => [series.slug, series]));

/** التحية بساعة الرياض — صباحًا حتى الظهر ثم مساء المعرفة. */
function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Riyadh" }).format(
      new Date(),
    ),
  );
  return hour >= 5 && hour < 12 ? "صباح المعرفة" : "مساء المعرفة";
}

const riyadhTime = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Riyadh",
  }).format(new Date(iso));

function guardChip(title: string, body: string): { tone: "ok" | "warn" | "block"; label: string; blocking: number } {
  const report = runPolicyGuard({ title, body: stripHtmlToText(body) });
  if (report.counts.blocking > 0)
    return { tone: "block", label: `${report.counts.blocking} قاطع`, blocking: report.counts.blocking };
  if (report.counts.warning > 0) return { tone: "warn", label: `${report.counts.warning} تحذير`, blocking: 0 };
  return { tone: "ok", label: "سليم", blocking: 0 };
}

export default async function OverviewPage() {
  const actor = await loadActor();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [counts, todayCount, perDay, review, latestPublished, latestDraft, scheduled, distribution] =
    await Promise.all([
      statusCounts().catch(() => ({}) as Record<string, number>),
      publishedTodayCount().catch(() => 0),
      publishedPerDay(14).catch(() => []),
      listLatestByStatus("review", 6).catch(() => []),
      listLatestByStatus("published", 5).catch(() => []),
      listLatestByStatus("draft", 1).catch(() => []),
      listLatestByStatus("scheduled", 40).catch(() => []),
      seriesDistribution().catch(() => []),
    ]);
  const reviewBodies = await bodiesFor(review.map((row) => row.id));
  const reviewChips = new Map(
    review.map((row) => {
      const content = reviewBodies.get(row.id);
      return [row.id, content ? guardChip(content.title, content.body) : { tone: "ok" as const, label: "—", blocking: 0 }];
    }),
  );
  const blockingInReview = [...reviewChips.values()].filter((chip) => chip.blocking > 0).length;

  const totalsBySlug = new Map(distribution.map((row) => [row.seriesSlug, row]));
  const seriesCounts = SERIES.map((series) => ({
    ...series,
    count: totalsBySlug.get(series.slug)?.total ?? 0,
  }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const maxCount = Math.max(1, ...seriesCounts.map((series) => series.count));
  const weekTotal = distribution.reduce((sum, row) => sum + row.week, 0);
  const totalStories = Object.entries(counts).reduce(
    (sum, [key, value]) => (key === "archived" ? sum : sum + value),
    0,
  );
  const reviewCount = counts.review ?? 0;
  const weekAverage = perDay.length ? perDay.slice(-7).reduce((sum, day) => sum + day.count, 0) / 7 : 0;

  const timeline: TimelineItem[] = [
    ...latestPublished
      .filter((row) => (row.publishedAt ?? "").startsWith(todayIso))
      .map((row) => ({ row, at: row.publishedAt!, state: "done" as const, meta: "نُشرت" })),
    ...scheduled
      .filter((row) => (row.scheduledAt ?? "").startsWith(todayIso))
      .map((row) => ({ row, at: row.scheduledAt!, state: "later" as const, meta: "مجدولة · تُنشر تلقائيًا" })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((entry, index, all) => ({
      id: entry.row.id,
      time: riyadhTime(entry.at),
      title: entry.row.title,
      href: editorHref(entry.row),
      state:
        entry.state === "later" && all.findIndex((other) => other.state === "later") === index
          ? "next"
          : entry.state,
      meta: entry.meta,
    }));

  const firstName = actor?.displayName.split(" ")[0] ?? "";
  const scheduledToday = timeline.filter((item) => item.state !== "done").length;
  const subtitle = [
    todayCount > 0 ? `${todayCount} مواد نُشرت اليوم` : "لم يُنشر شيء بعد اليوم",
    scheduledToday > 0 ? `${scheduledToday} مجدولة لاحقًا` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-xl font-extrabold lg:text-[22px]">
          {greeting()} يا {firstName}
        </h1>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="منشور اليوم"
          value={todayCount}
          hint={
            todayCount > weekAverage
              ? `↑ فوق معدّل الأسبوع (${weekAverage.toFixed(1)})`
              : `معدّل الأسبوع ${weekAverage.toFixed(1)} يوميًا`
          }
          tone={todayCount > weekAverage ? "ok" : undefined}
          series={perDay.map((day) => day.count)}
          color="var(--t-ok)"
        />
        <StatTile
          label="بانتظار الاعتماد"
          value={reviewCount}
          hint={
            blockingInReview > 0
              ? `${blockingInReview} فيها مخالفة قاطعة`
              : reviewCount > 0
                ? "تحتاج قرار معتمد"
                : "القائمة فارغة"
          }
          tone={blockingInReview > 0 ? "warn" : undefined}
        />
        <StatTile
          label="مسودات نشطة"
          value={counts.draft ?? 0}
          hint={
            latestDraft[0]?.updatedAt
              ? `آخر تحرير ${relativeTimeAr(latestDraft[0].updatedAt) ?? ""}`
              : "لا تحرير جارٍ"
          }
        />
        <StatTile
          label="إجمالي المواد"
          value={totalStories}
          hint={`عبر ${SERIES.length} سلاسل · ${weekTotal} هذا الأسبوع`}
        />
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[1.55fr_1fr]">
        <Panel title="بانتظار الاعتماد" href="/tahrir/stories?status=review" hrefLabel="كل القائمة">
          {review.length === 0 ? <PanelEmpty>لا مواد بانتظار الاعتماد الآن.</PanelEmpty> : null}
          {review.map((story) => {
            const chip = reviewChips.get(story.id)!;
            const series = story.seriesSlug ? seriesBySlug.get(story.seriesSlug) : undefined;
            return (
              <Link
                key={story.id}
                href={editorHref(story)}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 px-4 py-2.5 last:border-0 hover:bg-muted/50 transition-colors sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
              >
                <GuardChip tone={chip.tone} label={chip.label} />
                <span className="truncate text-[13px] font-semibold">{story.title}</span>
                {series ? <SeriesTag name={series.name} color={series.color} className="hidden sm:inline-flex" /> : <span className="hidden sm:inline" />}
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {story.authorName || "—"}
                  {relativeTimeAr(story.updatedAt ?? undefined) ? ` · ${relativeTimeAr(story.updatedAt ?? undefined)}` : ""}
                </span>
              </Link>
            );
          })}
          <PanelHeader title="آخر ما نُشر" href="/tahrir/schedule" hrefLabel="الجدولة" className="border-t border-border/80" />
          {latestPublished.map((story) => {
            const series = story.seriesSlug ? seriesBySlug.get(story.seriesSlug) : undefined;
            return (
              <Link
                key={story.id}
                href={editorHref(story)}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 px-4 py-2.5 last:border-0 hover:bg-muted/50 transition-colors sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
              >
                <StatusPill status="published" label="منشور" />
                <span className="truncate text-[13px] font-semibold">{story.title}</span>
                {series ? <SeriesTag name={series.name} color={series.color} className="hidden sm:inline-flex" /> : <span className="hidden sm:inline" />}
                <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                  {story.publishedAt ? (story.publishedAt.startsWith(todayIso) ? riyadhTime(story.publishedAt) : story.publishedAt.slice(0, 10)) : "—"}
                </span>
              </Link>
            );
          })}
        </Panel>

        <div className="grid gap-3">
          <Panel title="السلاسل — توزيع المواد">
            <div className="grid gap-2 px-4 py-3">
              {seriesCounts.map((series) => (
                <div key={series.slug} className="grid grid-cols-[78px_1fr_auto] items-center gap-2.5 text-xs">
                  <span className="truncate">{series.name}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <i
                      className="block h-full rounded-full"
                      style={{ width: `${(series.count / maxCount) * 100}%`, background: series.color }}
                    />
                  </span>
                  <b className="min-w-6 text-start font-display text-[11.5px] text-muted-foreground tabular-nums">
                    {series.count}
                  </b>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="جدول اليوم" aside="توقيت الرياض">
            {timeline.length === 0 ? (
              <PanelEmpty>لا نشر ولا جدولة اليوم بعد — الجدولة من داخل المحرر.</PanelEmpty>
            ) : (
              <TodayTimeline items={timeline} />
            )}
          </Panel>
        </div>
      </div>
    </main>
  );
}
