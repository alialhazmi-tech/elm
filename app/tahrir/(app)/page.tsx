import {
  CalendarClockIcon,
  CalendarDaysIcon,
  ChartNoAxesColumnIcon,
  CheckCheckIcon,
  HistoryIcon,
  ImagesIcon,
  LayersIcon,
  ListIcon,
  PenLineIcon,
  SendIcon,
} from "lucide-react";

import { GuardChip, StatusPill } from "@/components/tahrir/badges";
import { AttentionBar, type AttentionItem } from "@/components/tahrir/overview/attention";
import { Bars } from "@/components/tahrir/overview/bars";
import { PageHeader } from "@/components/tahrir/overview/page-header";
import { Panel, PanelEmpty } from "@/components/tahrir/overview/panel";
import { QuickActions, type QuickAction } from "@/components/tahrir/overview/quick-actions";
import { StatTile } from "@/components/tahrir/overview/stat-tile";
import { StoryRow } from "@/components/tahrir/overview/story-row";
import { TodayTimeline, type TimelineItem } from "@/components/tahrir/overview/today-timeline";
import { stripHtmlToText } from "@/lib/content/html";
import { SERIES } from "@/lib/content/series";
import { relativeTimeAr } from "@/lib/format";
import { loadAiSettings } from "@/lib/ai/settings";
import { runConfiguredPolicyGuard, type GuardControls } from "@/lib/policy";
import { loadActor } from "@/lib/tahrir/access";
import { editorHref } from "@/lib/tahrir/routes";
import {
  listPageForReview,
  countMedia,
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

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(iso));

/** عدد + «مادة» بقواعد العربية. */
function storiesCount(n: number): string {
  if (n === 1) return "مادة واحدة";
  if (n === 2) return "مادتان";
  if (n <= 10) return `${n} مواد`;
  return `${n} مادة`;
}

function guardChip(title: string, body: string, controls: GuardControls): { tone: "ok" | "warn" | "block"; label: string; blocking: number } {
  const report = runConfiguredPolicyGuard({ title, body: stripHtmlToText(body) }, controls);
  if (report.counts.blocking > 0)
    return { tone: "block", label: `${report.counts.blocking} قاطع`, blocking: report.counts.blocking };
  if (report.counts.warning > 0) return { tone: "warn", label: `${report.counts.warning} تحذير`, blocking: 0 };
  return { tone: "ok", label: "سليم", blocking: 0 };
}

export default async function OverviewPage() {
  const actor = await loadActor();
  const can = (key: string) => actor?.can(key) ?? false;
  const todayIso = new Date().toISOString().slice(0, 10);
  const [settings, counts, todayCount, perDay, review, latestPublished, latestDraft, scheduled, distribution, media] =
    await Promise.all([
      loadAiSettings(),
      statusCounts().catch(() => ({}) as Record<string, number>),
      publishedTodayCount().catch(() => 0),
      publishedPerDay(14).catch(() => []),
      listPageForReview("review", 1, 6).catch(() => []),
      listLatestByStatus("published", 12).catch(() => []),
      listLatestByStatus("draft", 5).catch(() => []),
      listLatestByStatus("scheduled", 40).catch(() => []),
      seriesDistribution().catch(() => []),
      countMedia().catch(() => ({ all: 0, ok: 0, pending: 0 })),
    ]);
  const reviewChips = new Map(
    review.map((row) => [row.id, guardChip(row.title, row.body, settings.governance)] as const),
  );
  const blockingInReview = [...reviewChips.values()].filter((chip) => chip.blocking > 0).length;

  const totalsBySlug = new Map(distribution.map((row) => [row.seriesSlug, row]));
  const seriesRows = SERIES.map((series) => {
    const row = totalsBySlug.get(series.slug);
    return { label: series.name, color: series.color, count: row?.total ?? 0, week: row?.week ?? 0 };
  }).sort((a, b) => b.count - a.count);
  const maxSeries = Math.max(1, ...seriesRows.map((series) => series.count));
  const weekTotal = distribution.reduce((sum, row) => sum + row.week, 0);
  const totalStories = Object.entries(counts).reduce(
    (sum, [key, value]) => (key === "archived" ? sum : sum + value),
    0,
  );
  const reviewCount = counts.review ?? 0;
  const draftCount = counts.draft ?? 0;
  const weekAverage = perDay.length ? perDay.slice(-7).reduce((sum, day) => sum + day.count, 0) / 7 : 0;

  // جدول اليوم: ما نُشر اليوم + ما سيُنشر اليوم، مرتّبًا بالوقت، وأول القادم هو «التالي».
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
    } satisfies TimelineItem))
    .reverse();
  const doneToday = timeline.filter((item) => item.state === "done").length;
  const remainingToday = timeline.length - doneToday;
  const nextToday = timeline.find((item) => item.state === "next");

  // ما نُشر قبل اليوم — مكمّل لجدول اليوم لا مكرّر له.
  const publishedEarlier = latestPublished.filter((row) => !(row.publishedAt ?? "").startsWith(todayIso)).slice(0, 5);

  const upcomingScheduled = scheduled
    .filter((row) => (row.scheduledAt ?? "") > todayIso && !(row.scheduledAt ?? "").startsWith(todayIso))
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .slice(0, 5);

  const firstName = actor?.displayName.split(" ")[0] ?? "";
  const description = [
    todayCount > 0 ? `نُشرت ${storiesCount(todayCount)} اليوم` : "لم يُنشر شيء بعد اليوم",
    remainingToday > 0 ? `${storiesCount(remainingToday)} مجدولة لاحقًا` : null,
    `معدّل الأسبوع ${weekAverage.toFixed(1)} يوميًا`,
  ]
    .filter(Boolean)
    .join(" · ");

  const quickActionCandidates: Array<QuickAction | null> = [
    can("story.approve")
      ? { label: "الاعتماد", href: "/tahrir/stories?status=review", icon: CheckCheckIcon, count: reviewCount }
      : null,
    can("story.schedule") ? { label: "الجدولة", href: "/tahrir/schedule", icon: CalendarClockIcon } : null,
    can("media.upload") ? { label: "الوسائط", href: "/tahrir/media", icon: ImagesIcon } : null,
    can("stats.view") ? { label: "الإحصاءات", href: "/tahrir/stats", icon: ChartNoAxesColumnIcon } : null,
  ];
  const quickActions = quickActionCandidates.filter((action): action is QuickAction => action !== null);

  const canSeeMedia = can("media.rights") || can("media.upload");
  const attentionCandidates: Array<AttentionItem | null> = [
    blockingInReview > 0
      ? {
          id: "blocking",
          tone: "block",
          label: `${storiesCount(blockingInReview)} في الاعتماد فيها مخالفة قاطعة`,
          detail: "لا تُنشر قبل الإصلاح",
          href: "/tahrir/stories?status=review",
        }
      : reviewCount > 0 && can("story.approve")
        ? {
            id: "review",
            tone: "warn",
            label: `${storiesCount(reviewCount)} بانتظار قرارك`,
            detail: review[0]?.title,
            href: "/tahrir/stories?status=review",
          }
        : null,
    nextToday
      ? {
          id: "next",
          tone: "sug",
          label: `الموعد التالي ${nextToday.time}`,
          detail: nextToday.title,
          href: nextToday.href,
          icon: CalendarClockIcon,
        }
      : null,
    canSeeMedia && media.pending > 0
      ? {
          id: "media",
          tone: "warn",
          label: `${media.pending} صور بلا توثيق حقوق`,
          detail: "التوثيق شرط للنشر والجدولة",
          href: "/tahrir/media?f=pending",
          icon: ImagesIcon,
        }
      : null,
  ];
  const attention = attentionCandidates.filter((item): item is AttentionItem => item !== null);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title={`${greeting()} يا ${firstName}`} description={description}>
        <QuickActions actions={quickActions} />
      </PageHeader>

      <AttentionBar
        items={attention}
        calmMessage="لا شيء عالق الآن — طابور الاعتماد فارغ، ولا صور بانتظار التوثيق."
      />

      <section aria-label="مؤشرات اليوم" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="منشور اليوم"
          value={todayCount}
          icon={SendIcon}
          href="/tahrir/stories?status=published"
          hint={
            todayCount > weekAverage
              ? `فوق معدّل الأسبوع (${weekAverage.toFixed(1)})`
              : `معدّل الأسبوع ${weekAverage.toFixed(1)} يوميًا`
          }
          tone={todayCount > weekAverage ? "ok" : undefined}
          series={perDay.map((day) => day.count)}
          color="var(--t-ok)"
        />
        <StatTile
          label="بانتظار الاعتماد"
          value={reviewCount}
          icon={CheckCheckIcon}
          href="/tahrir/stories?status=review"
          hint={
            blockingInReview > 0
              ? `${blockingInReview} فيها مخالفة قاطعة`
              : reviewCount > 0
                ? "تحتاج قرار معتمد"
                : "الطابور فارغ"
          }
          tone={blockingInReview > 0 ? "block" : reviewCount > 0 ? "warn" : undefined}
        />
        <StatTile
          label="مسودات نشطة"
          value={draftCount}
          icon={PenLineIcon}
          href="/tahrir/stories?status=draft"
          hint={
            latestDraft[0]?.updatedAt
              ? `آخر تحرير ${relativeTimeAr(latestDraft[0].updatedAt) ?? ""}`
              : "لا تحرير جارٍ"
          }
        />
        <StatTile
          label="إجمالي المواد"
          value={totalStories}
          icon={ListIcon}
          href="/tahrir/stories"
          hint={`عبر ${SERIES.length} سلاسل · ${weekTotal} هذا الأسبوع`}
        />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <Panel
            title="بانتظار الاعتماد"
            icon={CheckCheckIcon}
            count={reviewCount}
            href="/tahrir/stories?status=review"
            hrefLabel="كل القائمة"
          >
            {review.length === 0 ? (
              <PanelEmpty icon={CheckCheckIcon} title="الطابور فارغ">
                كل ما رُفع للاعتماد بُتّ فيه — ما يُرفع لاحقًا يظهر هنا مع نتيجة الحارس.
              </PanelEmpty>
            ) : (
              review.map((story) => {
                const chip = reviewChips.get(story.id)!;
                const author = story.authorName || "—";
                const when = relativeTimeAr(story.updatedAt ?? undefined);
                return (
                  <StoryRow
                    key={story.id}
                    href={editorHref(story)}
                    title={story.title}
                    leading={<GuardChip tone={chip.tone} label={chip.label} />}
                    series={story.seriesSlug ? seriesBySlug.get(story.seriesSlug) : null}
                    meta={when ? `${author} · ${when}` : author}
                  />
                );
              })
            )}
          </Panel>

          <Panel
            title="جدول اليوم"
            icon={CalendarDaysIcon}
            href={can("story.schedule") ? "/tahrir/schedule" : undefined}
            hrefLabel="الجدولة"
            aside={timeline.length > 0 ? `${doneToday} نُشرت · ${remainingToday} متبقية` : "توقيت الرياض"}
          >
            {timeline.length === 0 ? (
              <PanelEmpty
                icon={CalendarDaysIcon}
                title="لا نشر ولا جدولة اليوم بعد"
                action={can("story.schedule") ? { href: "/tahrir/schedule", label: "افتح الجدولة" } : undefined}
              >
                الجدولة تتم من داخل المحرر، وما يُنشر أو يُجدول اليوم يظهر هنا بترتيب الوقت.
              </PanelEmpty>
            ) : (
              <TodayTimeline items={timeline} />
            )}
          </Panel>

          <Panel
            title="المسودات قيد التحرير"
            icon={PenLineIcon}
            count={draftCount}
            href="/tahrir/stories?status=draft"
            hrefLabel="كل المسودات"
          >
            {latestDraft.length === 0 ? (
              <PanelEmpty
                icon={PenLineIcon}
                title="لا مسودات قيد التحرير"
                action={can("story.create") ? { href: "/tahrir/editor/new", label: "ابدأ مادة جديدة" } : undefined}
              >
                كل مسودة تُحفظ في المحرر تظهر هنا مع آخر تحرير وكاتبها.
              </PanelEmpty>
            ) : (
              latestDraft.map((story) => {
                const author = story.authorName || "—";
                const when = relativeTimeAr(story.updatedAt ?? undefined);
                return (
                  <StoryRow
                    key={story.id}
                    href={editorHref(story)}
                    title={story.title || "مسودة بلا عنوان"}
                    series={story.seriesSlug ? seriesBySlug.get(story.seriesSlug) : null}
                    meta={when ? `${author} · ${when}` : author}
                  />
                );
              })
            )}
          </Panel>
        </div>

        <div className="grid gap-4">
          <Panel
            title="المجدول للأيام القادمة"
            icon={CalendarClockIcon}
            count={upcomingScheduled.length}
            href={can("story.schedule") ? "/tahrir/schedule" : undefined}
            hrefLabel="الجدولة"
          >
            {upcomingScheduled.length === 0 ? (
              <PanelEmpty compact icon={CalendarClockIcon}>
                لا مواد مجدولة لما بعد اليوم.
              </PanelEmpty>
            ) : (
              upcomingScheduled.map((story) => (
                <StoryRow
                  key={story.id}
                  href={editorHref(story)}
                  title={story.title}
                  series={story.seriesSlug ? seriesBySlug.get(story.seriesSlug) : null}
                  meta={story.scheduledAt ? `${shortDate(story.scheduledAt)} · ${riyadhTime(story.scheduledAt)}` : "—"}
                />
              ))
            )}
          </Panel>

          <Panel title="السلاسل" icon={LayersIcon} aside={`${weekTotal} هذا الأسبوع`}>
            <Bars
              rows={seriesRows.map((series) => ({
                label: series.label,
                count: series.count,
                color: series.color,
                note: series.week > 0 ? `+${series.week}` : undefined,
              }))}
              max={maxSeries}
              labelWidth={76}
            />
          </Panel>

          <Panel title="نُشر مؤخرًا" icon={HistoryIcon} aside="قبل اليوم" href="/tahrir/stories?status=published" hrefLabel="المنشور">
            {publishedEarlier.length === 0 ? (
              <PanelEmpty compact icon={HistoryIcon}>
                لا منشور قبل اليوم ضمن آخر 12 مادة.
              </PanelEmpty>
            ) : (
              publishedEarlier.map((story) => (
                <StoryRow
                  key={story.id}
                  href={editorHref(story)}
                  title={story.title}
                  leading={<StatusPill status="published" label="منشور" />}
                  series={story.seriesSlug ? seriesBySlug.get(story.seriesSlug) : null}
                  meta={story.publishedAt ? shortDate(story.publishedAt) : "—"}
                />
              ))
            )}
          </Panel>
        </div>
      </div>
    </main>
  );
}
