import { Bars } from "@/components/tahrir/overview/bars";
import { Panel } from "@/components/tahrir/overview/panel";
import { StatTile } from "@/components/tahrir/overview/stat-tile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { stripHtmlToText } from "@/lib/content/html";
import { SERIES } from "@/lib/content/series";
import { loadAiSettings } from "@/lib/ai/settings";
import { runConfiguredPolicyGuard } from "@/lib/policy";
import { requireScreen } from "@/lib/tahrir/screen";
import {
  bodiesFor,
  formatDistribution,
  listAudit,
  listLatestByStatus,
  listPage,
  publishedPerDay,
  readingTimeDistribution,
  seriesDistribution,
  statusCounts,
  topAuthors,
} from "@/lib/tahrir/service";
import { cn } from "@/lib/utils";

export const metadata = { title: "الإحصاءات" };
export const dynamic = "force-dynamic";

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const FORMAT_NAMES: Record<string, { label: string; color: string }> = {
  news: { label: "أخبار", color: "var(--primary)" },
  infographics: { label: "إنفوجرافيك", color: "#3b82f6" },
  videos: { label: "فيديو", color: "#ef4444" },
  reports: { label: "تقارير", color: "#10b981" },
  podcasts: { label: "بودكاست", color: "#8b5cf6" },
  jakalelm: { label: "جاك العلم", color: "#f59e0b" },
};

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function StatsPage() {
  const gate = await requireScreen("stats.view", "الإحصاءات");
  if (!gate.ok) return gate.element;
  const [settings, counts, audit, recentPublished, distribution, perDay, formats, authors, readingTime] = await Promise.all([
    loadAiSettings(),
    statusCounts().catch(() => ({}) as Record<string, number>),
    listAudit(500).catch(() => []),
    listLatestByStatus("published", 400).catch(() => []),
    seriesDistribution().catch(() => []),
    publishedPerDay(14).catch(() => []),
    formatDistribution().catch(() => []),
    topAuthors(6).catch(() => []),
    readingTimeDistribution().catch(() => ({ quick: 0, medium: 0, long: 0 })),
  ]);

  // إيقاع النشر آخر 14 يومًا حسب اليوم — من أحدث المنشور (خفيف بلا متون).
  const twoWeeksAgo = daysAgoIso(14);
  const recent = recentPublished.filter((row) => (row.publishedAt ?? "") >= twoWeeksAgo);
  const byDay = DAY_NAMES.map((name, index) => ({
    name,
    count: recent.filter((row) => new Date(row.publishedAt!).getDay() === index).length,
  }));
  const maxDay = Math.max(1, ...byDay.map((day) => day.count));

  // الحارس على أحدث 100 مادة — عينة حية بدل مسح الأرشيف كله في كل زيارة.
  const samplePage = await listPage(undefined, 1, 100).catch(() => []);
  const sampleBodies = await bodiesFor(samplePage.map((row) => row.id));
  const guardTotals = { blocking: 0, warning: 0, suggestion: 0, clean: 0 };
  for (const [, content] of sampleBodies) {
    const report = runConfiguredPolicyGuard({ title: content.title, body: stripHtmlToText(content.body) }, settings.governance);
    guardTotals.blocking += report.counts.blocking;
    guardTotals.warning += report.counts.warning;
    guardTotals.suggestion += report.counts.suggestion;
    if (report.findings.length === 0) guardTotals.clean += 1;
  }
  const maxGuard = Math.max(1, guardTotals.blocking, guardTotals.warning, guardTotals.suggestion);

  const totalsBySlug = new Map(distribution.map((row) => [row.seriesSlug, row.total]));
  const seriesCounts = SERIES.map((series) => ({ ...series, count: totalsBySlug.get(series.slug) ?? 0 })).sort(
    (a, b) => b.count - a.count,
  );
  const maxSeries = Math.max(1, ...seriesCounts.map((series) => series.count));
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const guardBlocks = audit.filter((row) => row.action === "schedule:blocked" || row.action.startsWith("series:proposal")).length;

  const formatRows = formats.map((f) => {
    const meta = FORMAT_NAMES[f.format] ?? { label: f.format, color: "var(--t-sug)" };
    return {
      label: meta.label,
      count: f.count,
      color: meta.color,
    };
  });
  const maxFormat = Math.max(1, ...formatRows.map((r) => r.count));

  const authorRows = authors.map((a) => ({
    label: a.authorName,
    count: a.count,
    color: "var(--primary)",
  }));
  const maxAuthor = Math.max(1, ...authorRows.map((r) => r.count));

  const readingRows = [
    { label: "سريعة (< 3 د)", count: readingTime.quick, color: "var(--t-ok)" },
    { label: "متوسطة (3–5 د)", count: readingTime.medium, color: "var(--t-sug)" },
    { label: "مطولة (> 5 د)", count: readingTime.long, color: "var(--t-warn)" },
  ];
  const maxReading = Math.max(1, ...readingRows.map((r) => r.count));

  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">الإحصاءات</h1>
        <span className="text-xs text-muted-foreground">محسوبة من قاعدة البيانات والحارس مباشرة</span>
      </div>
      <Alert>
        <AlertDescription>
          مؤشرات القراء (الزيارات، زمن القراءة، الاكتمال) تتفعل مع القياس الميداني RUM عند النشر الإنتاجي على Cloudflare — لا
          نعرض أرقامًا غير مقاسة.
        </AlertDescription>
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="مواد منشورة" value={counts.published ?? 0} hint={`من إجمالي ${total}`} />
        <StatTile
          label="نُشر آخر 14 يومًا"
          value={recent.length}
          hint={`${(recent.length / 14).toFixed(1)} مادة يوميًا`}
          series={perDay.map((day) => day.count)}
          color="var(--t-ok)"
        />
        <StatTile label="مواد سليمة من الحارس" value={guardTotals.clean} hint="من أحدث 100" tone="ok" />
        <StatTile label="قراء الآن" value={0} hint="بانتظار RUM — يتفعل مع الإنتاج" />
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-[1.55fr_1fr]">
        <Panel title="إيقاع النشر — آخر 14 يومًا بالأيام">
          <div className="grid h-40 grid-cols-7 items-end gap-2 px-4 pt-4 pb-2">
            {byDay.map((day) => (
              <div key={day.name} className="grid h-full grid-rows-[1fr_auto] gap-1.5 text-center">
                <div className="flex items-end justify-center">
                  <i
                    title={String(day.count)}
                    className={cn("block w-full max-w-9 rounded-t-md", day.count === maxDay && day.count > 0 ? "bg-primary" : "bg-(--t-sug)/60")}
                    style={{ height: `${Math.max(4, (day.count / maxDay) * 100)}%` }}
                  />
                </div>
                <span className="text-[10.5px] text-muted-foreground">{day.name}</span>
              </div>
            ))}
          </div>
          <div className="border-t px-4 py-2.5 font-display text-[13px] font-bold">توزيع المنشور على السلاسل</div>
          <Bars rows={seriesCounts.map((series) => ({ label: series.name, count: series.count, color: series.color }))} max={maxSeries} />
        </Panel>
        <div className="grid gap-3">
          <Panel title="حارس السياسة — أحدث 100 مادة">
            <Bars
              rows={[
                { label: "قاطعة", count: guardTotals.blocking, color: "var(--t-block)" },
                { label: "تحذيرات", count: guardTotals.warning, color: "var(--t-warn)" },
                { label: "مقترحات", count: guardTotals.suggestion, color: "var(--t-sug)" },
              ]}
              max={maxGuard}
            />
          </Panel>
          <Panel title="نشاط اللوحة">
            <div className="grid gap-1 px-4 py-3 text-xs text-muted-foreground">
              <span>
                أحداث مسجلة: <b className="text-foreground tabular-nums">{audit.length}</b> (آخر 500)
              </span>
              <span>
                قرارات حوكمة (منع حارس + مقترحات): <b className="text-foreground tabular-nums">{guardBlocks}</b>
              </span>
              <span>التفصيل الكامل في سجل التدقيق.</span>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Panel title="توزيع أشكال المحتوى" aside="المنشور">
          {formatRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">لا بيانات لأشكال المحتوى</div>
          ) : (
            <Bars rows={formatRows} max={maxFormat} />
          )}
        </Panel>

        <Panel title="أكثر الكُتّاب إنتاجًا" aside="المواد المنشورة">
          {authorRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">لا كُتّاب مسجلون</div>
          ) : (
            <Bars rows={authorRows} max={maxAuthor} />
          )}
        </Panel>

        <Panel title="أزمنة القراءة للمواد" aside="حسب دقائق القراءة">
          <Bars rows={readingRows} max={maxReading} />
        </Panel>
      </div>
    </main>
  );
}
