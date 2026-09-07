import Link from "next/link";
import { ScheduleRefresh } from "@/components/tahrir/schedule-refresh";

import { SeriesTag, StatusPill } from "@/components/tahrir/badges";
import { Panel, PanelEmpty } from "@/components/tahrir/overview/panel";
import { TodayTimeline, type TimelineItem } from "@/components/tahrir/overview/today-timeline";
import { SERIES } from "@/lib/content/series";
import { editorHref } from "@/lib/tahrir/routes";
import { listLatestByStatus } from "@/lib/tahrir/service";

export const metadata = { title: "جدولة النشر" };
export const dynamic = "force-dynamic";

const seriesBySlug = new Map<string, (typeof SERIES)[number]>(SERIES.map((series) => [series.slug, series]));

const hourOf = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Riyadh",
  }).format(new Date(iso));

const dayOf = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Riyadh",
  }).format(new Date(iso));

export default async function SchedulePage() {
  const automatic = process.env.ALELM_SCHEDULER_INTERVAL_MS === "5000";
  // المراقب الداخلي أو الخارجي ينشر عبر POST موثق؛ هذه الشاشة للقراءة فقط.
  const [latestPublished, scheduled] = await Promise.all([
    listLatestByStatus("published", 60).catch(() => []),
    listLatestByStatus("scheduled", 100).catch(() => []),
  ]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayItems: TimelineItem[] = [
    ...latestPublished
      .filter((row) => (row.publishedAt ?? "").startsWith(todayIso))
      .map((row) => ({ row, at: row.publishedAt!, state: "done" as const })),
    ...scheduled
      .filter((row) => (row.scheduledAt ?? "").startsWith(todayIso))
      .map((row) => ({ row, at: row.scheduledAt!, state: "later" as const })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((entry, index, all) => {
      const series = entry.row.seriesSlug ? seriesBySlug.get(entry.row.seriesSlug) : undefined;
      return {
        id: entry.row.id,
        time: hourOf(entry.at),
        title: entry.row.title,
        href: editorHref(entry.row),
        state:
          entry.state === "later" && all.findIndex((other) => other.state === "later") === index ? "next" : entry.state,
        meta: `${entry.state === "done" ? "نُشرت" : (automatic ? "مجدولة · تُنشر تلقائيًا" : "مجدولة · تحقق من تشغيل المجدول")}${series ? ` · ${series.name}` : ""}`,
      } satisfies TimelineItem;
    })
    .reverse();

  const upcoming = scheduled
    .filter((row) => !(row.scheduledAt ?? "").startsWith(todayIso))
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));

  return (
    <main className="flex flex-col gap-3">
      <ScheduleRefresh active={scheduled.length > 0} />
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">جدولة النشر</h1>
        <span className="text-xs text-muted-foreground tabular-nums">
          {scheduled.length} مادة مجدولة · {todayItems.length} في جدول اليوم
        </span>
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="جدول اليوم" href="/tahrir/stories?status=scheduled" hrefLabel="كل المجدول">
          {todayItems.length === 0 ? (
            <PanelEmpty>لا نشر ولا جدولة اليوم بعد — الجدولة من داخل المحرر.</PanelEmpty>
          ) : (
            <TodayTimeline items={todayItems} />
          )}
        </Panel>
        <div className="grid gap-3">
          <Panel title="القادم بعد اليوم">
            {upcoming.length === 0 ? <PanelEmpty>لا مواد مجدولة لاحقًا.</PanelEmpty> : null}
            {upcoming.slice(0, 12).map((row) => {
              const series = row.seriesSlug ? seriesBySlug.get(row.seriesSlug) : undefined;
              return (
                <Link
                  key={row.id}
                  href={editorHref(row)}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b px-4 py-2.5 last:border-0 hover:bg-muted/60"
                >
                  <StatusPill status="scheduled" label={dayOf(row.scheduledAt!)} />
                  <span className="grid min-w-0 leading-tight">
                    <span className="truncate text-[13px] font-semibold">{row.title}</span>
                    {series ? <SeriesTag name={series.name} color={series.color} className="mt-0.5" /> : null}
                  </span>
                </Link>
              );
            })}
          </Panel>
          <Panel title="كيف تعمل الجدولة">
            <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              الجدولة من المحرر ومن صلاحية <b className="text-foreground">المعتمدين</b> — الحارس يفحص المادة عند الجدولة، ثم
              يفحصها <b className="text-foreground">ثانية لحظة الموعد</b>: السليمة تُنشر آليًا، وأي مخالفة قاطعة توقف النشر
              وتعيدها للاعتماد مع تدوين السبب في السجل.
              {automatic ? " يعمل المجدول مع الخادم ويفحص المواعيد كل 5 ثوانٍ، حتى عند إغلاق اللوحة. تتحدث هذه الصفحة تلقائيًا لمتابعة النشر. قد يتأخر التنفيذ قليلًا بحسب استجابة الخادم." : " مشغّل الجدولة الداخلي غير مفعّل في هذه البيئة؛ يجب التحقق من إعداد تشغيل الجدولة قبل الاعتماد على النشر التلقائي."}
            </p>
          </Panel>
        </div>
      </div>
    </main>
  );
}
