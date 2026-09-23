import Link from "next/link";

import { Pagination } from "@/components/tahrir/pagination";
import { StoriesTable } from "@/components/tahrir/stories/stories-table";
import { StoriesToolbar } from "@/components/tahrir/stories/toolbar";
import type { StoryTableRow } from "@/components/tahrir/stories/types";
import { stripHtmlToText } from "@/lib/content/html";
import { SECTION_NAMES } from "@/lib/content/seed";
import { ALL_SERIES } from "@/lib/content/series";
import { loadAiSettings } from "@/lib/ai/settings";
import { runConfiguredPolicyGuard, type GuardControls } from "@/lib/policy";
import { requireScreenActor } from "@/lib/tahrir/screen";
import { canEditStory } from "@/lib/tahrir/access";
import { pageRange } from "@/lib/tahrir/pagination";
import { editorHref } from "@/lib/tahrir/routes";
import { storedStoryHref } from "@/lib/content/canonical-stories";
import { inRiyadhDay, riyadhDayBounds } from "@/lib/tahrir/time";
import {
  ACTIVE_STATUSES,
  countPage,
  latestArchiveEvents,
  listPageForReview,
  statusCounts,
  STATUS_LABELS,
  type StoryStatus,
} from "@/lib/tahrir/service";
import { cn } from "@/lib/utils";

export const metadata = { title: "المواد" };
export const dynamic = "force-dynamic";

const PER_PAGE = 30;
const VALID_STATUSES = new Set<string>([...ACTIVE_STATUSES, "archived"]);
const seriesBySlug = new Map<string, (typeof ALL_SERIES)[number]>(ALL_SERIES.map((series) => [series.slug, series]));

const when = (iso: string, withTime = false) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
    timeZone: "Asia/Riyadh",
  }).format(new Date(iso));

function updatedLabel(iso: string | null | undefined, today = riyadhDayBounds()): string {
  if (!iso) return "—";
  return inRiyadhDay(iso, today) ? `اليوم ${when(iso, true).split(" ").pop()}` : when(iso);
}

function guardFor(title: string, body: string, surface: "design" | undefined, controls: GuardControls) {
  const report = runConfiguredPolicyGuard({ title, body: stripHtmlToText(body), surface }, controls);
  if (report.counts.blocking > 0) return { tone: "block" as const, label: `${report.counts.blocking} قاطع` };
  if (report.counts.warning > 0) return { tone: "warn" as const, label: `${report.counts.warning} تحذير` };
  return { tone: "ok" as const, label: "سليم" };
}

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; p?: string; q?: string; series?: string }>;
}) {
  const params = await searchParams;
  const actor = await requireScreenActor();
  const settingsPromise = loadAiSettings();
  const canArchive = actor?.can("story.archive") ?? false;
  const status = VALID_STATUSES.has(params.status ?? "") ? (params.status as StoryStatus) : undefined;
  const requestedPage = Number(params.p);
  const requested = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const q = (params.q ?? "").trim().slice(0, 80);
  const seriesSlug = params.series && seriesBySlug.has(params.series) ? params.series : "";
  const filters = { q: q || undefined, seriesSlug: seriesSlug || undefined };
  const hasFilters = Boolean(filters.q || filters.seriesSlug);
  const today = riyadhDayBounds();

  const [settings, counts, requestedRows, filteredCount] = await Promise.all([
    settingsPromise,
    statusCounts(),
    listPageForReview(status, requested, PER_PAGE, filters),
    hasFilters ? countPage(status, filters) : Promise.resolve(null),
  ]);
  const archivedCount = counts.archived ?? 0;
  const activeTotal = Object.entries(counts).reduce(
    (sum, [key, count]) => (key === "archived" ? sum : sum + count),
    0,
  );
  const total = filteredCount ?? (status ? (counts[status] ?? 0) : activeTotal);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  // رقم صفحة خارج المدى (رابط قديم أو مواد أُرشفت) يُقصّ إلى آخر صفحة بدل جدول فارغ؛ إعادة الجلب نادرة.
  const page = Math.min(requested, totalPages);
  const rows = page === requested ? requestedRows : await listPageForReview(status, page, PER_PAGE, filters);
  const archiveEvents = status === "archived" ? await latestArchiveEvents(rows.map((row) => row.id)) : new Map();

  const href = (targetStatus?: string, targetPage = 1) => {
    const query = new URLSearchParams();
    if (targetStatus) query.set("status", targetStatus);
    if (q) query.set("q", q);
    if (seriesSlug) query.set("series", seriesSlug);
    if (targetPage > 1) query.set("p", String(targetPage));
    const suffix = query.toString();
    return `/tahrir/stories${suffix ? `?${suffix}` : ""}`;
  };

  const tableRows: StoryTableRow[] = rows.map((story) => {
    const series = story.seriesSlug ? seriesBySlug.get(story.seriesSlug) : undefined;
    const archived = archiveEvents.get(story.id);
    const meta =
      story.status === "archived" && archived
        ? `أُرشفت ${when(archived.at, true)}${archived.actor ? ` · ${archived.actor}` : ""} — ${archived.reason}`
        : [story.authorName || null, SECTION_NAMES[story.section] ?? story.section].filter(Boolean).join(" · ");
    return {
      id: story.id,
      title: story.title,
      meta,
      series: series ? { name: series.name, color: series.color } : null,
      guard: guardFor(story.title, story.body, story.format === "jakalelm" ? "design" : undefined, settings.governance),
      status: story.status,
      statusLabel: STATUS_LABELS[story.status as StoryStatus] ?? story.status,
      updated: updatedLabel(story.updatedAt ?? story.publishedAt, today),
      href: canEditStory(actor, story) && (story.format !== "jakalelm" || actor.can("jak.manage")) ? editorHref(story) : null,
      publicHref: story.status === "published" ? storedStoryHref(story) : null,
      isJak: story.format === "jakalelm",
    };
  });

  const chips: Array<{ key: string | undefined; label: string; count: number }> = [
    { key: undefined, label: "الكل", count: activeTotal },
    ...ACTIVE_STATUSES.map((key) => ({ key, label: STATUS_LABELS[key], count: counts[key] ?? 0 })),
    { key: "archived", label: "مؤرشفة", count: archivedCount },
  ];
  const { from, to } = pageRange(page, PER_PAGE, total);

  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">المواد</h1>
        <span className="text-xs text-muted-foreground tabular-nums">
          {activeTotal} مادة نشطة · {archivedCount} مؤرشفة
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StoriesToolbar q={q} series={seriesSlug} />
        <div className="-mx-1 flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-border/80 bg-muted/30 p-0.5 [scrollbar-width:none] sm:mx-0">
          {chips.map((chip) => {
            const active = chip.key === status;
            return (
              <Link
                key={chip.label}
                href={href(chip.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 font-display text-xs font-semibold whitespace-nowrap transition-colors",
                  active
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {chip.label}
                <span className="text-[10px] text-muted-foreground tabular-nums">{chip.count}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <StoriesTable rows={tableRows} canArchive={canArchive} />

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(number) => href(status, number)}
        summary={`${from}–${to} من ${total}${hasFilters ? " (مرشّحة)" : ""}`}
      />
    </main>
  );
}
