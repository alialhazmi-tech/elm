import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { StoriesTable } from "@/components/tahrir/stories/stories-table";
import { StoriesToolbar } from "@/components/tahrir/stories/toolbar";
import type { StoryTableRow } from "@/components/tahrir/stories/types";
import { Button } from "@/components/ui/button";
import { stripHtmlToText } from "@/lib/content/html";
import { SECTION_NAMES } from "@/lib/content/seed";
import { ALL_SERIES } from "@/lib/content/series";
import { runPolicyGuard } from "@/lib/policy";
import { loadActor } from "@/lib/tahrir/access";
import { editorHref } from "@/lib/tahrir/routes";
import {
  ACTIVE_STATUSES,
  bodiesFor,
  countPage,
  latestArchiveEvents,
  listPage,
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

function updatedLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const today = new Date().toISOString().slice(0, 10);
  return iso.startsWith(today) ? `اليوم ${when(iso, true).split(" ").pop()}` : when(iso);
}

function guardFor(title: string, body: string, surface: "design" | undefined) {
  const report = runPolicyGuard({ title, body: stripHtmlToText(body), surface });
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
  const actor = await loadActor();
  const canArchive = actor?.can("story.archive") ?? false;
  const status = VALID_STATUSES.has(params.status ?? "") ? (params.status as StoryStatus) : undefined;
  const page = Math.max(1, Number(params.p) || 1);
  const q = (params.q ?? "").trim().slice(0, 80);
  const seriesSlug = params.series && seriesBySlug.has(params.series) ? params.series : "";
  const filters = { q: q || undefined, seriesSlug: seriesSlug || undefined };
  const hasFilters = Boolean(filters.q || filters.seriesSlug);

  const [counts, rows, filteredCount] = await Promise.all([
    statusCounts(),
    listPage(status, page, PER_PAGE, filters),
    hasFilters ? countPage(status, filters) : Promise.resolve(null),
  ]);
  const archivedCount = counts.archived ?? 0;
  const activeTotal = Object.entries(counts).reduce(
    (sum, [key, count]) => (key === "archived" ? sum : sum + count),
    0,
  );
  const total = filteredCount ?? (status ? (counts[status] ?? 0) : activeTotal);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const [archiveEvents, bodies] = await Promise.all([
    status === "archived" ? latestArchiveEvents(rows.map((row) => row.id)) : new Map(),
    bodiesFor(rows.map((row) => row.id)),
  ]);

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
    const content = bodies.get(story.id);
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
      guard: content
        ? guardFor(content.title, content.body, story.format === "jakalelm" ? "design" : undefined)
        : { tone: "ok", label: "—" },
      status: story.status,
      statusLabel: STATUS_LABELS[story.status as StoryStatus] ?? story.status,
      updated: updatedLabel(story.updatedAt ?? story.publishedAt),
      href: editorHref(story),
      publicHref: story.status === "published" ? `/${story.section}/${story.id}/${story.slug}` : null,
      isJak: story.format === "jakalelm",
    };
  });

  const chips: Array<{ key: string | undefined; label: string; count: number }> = [
    { key: undefined, label: "الكل", count: activeTotal },
    ...ACTIVE_STATUSES.map((key) => ({ key, label: STATUS_LABELS[key], count: counts[key] ?? 0 })),
    { key: "archived", label: "مؤرشفة", count: archivedCount },
  ];
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(total, page * PER_PAGE);
  const pageWindow = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (number) => number === 1 || number === totalPages || Math.abs(number - page) <= 1,
  );

  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl font-extrabold">المواد</h1>
        <span className="text-xs text-muted-foreground tabular-nums">
          {activeTotal} مادة نشطة · {archivedCount} مؤرشفة
        </span>
        <div className="ms-auto">
          <StoriesToolbar q={q} series={seriesSlug} />
        </div>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
        {chips.map((chip) => {
          const active = chip.key === status;
          return (
            <Link
              key={chip.label}
              href={href(chip.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 font-display text-xs font-semibold whitespace-nowrap transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {chip.label}
              <b className={cn("tabular-nums", active ? "text-primary" : "text-muted-foreground/80")}>{chip.count}</b>
            </Link>
          );
        })}
      </div>

      <StoriesTable rows={tableRows} canArchive={canArchive} />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {from}–{to} من {total}
          {hasFilters ? " (مرشّحة)" : ""}
        </span>
        {totalPages > 1 ? (
          <nav aria-label="ترقيم الصفحات" className="ms-auto flex items-center gap-1">
            <Button asChild size="sm" variant="outline" disabled={page <= 1} className={cn(page <= 1 && "pointer-events-none opacity-50")}>
              <Link href={href(status, page - 1)} aria-label="الصفحة السابقة">
                <ChevronRightIcon data-icon="inline-start" />
                الأحدث
              </Link>
            </Button>
            {pageWindow.map((number, index) => (
              <span key={number} className="contents">
                {index > 0 && pageWindow[index - 1] !== number - 1 ? <span className="px-1">…</span> : null}
                <Button asChild size="sm" variant={number === page ? "default" : "outline"} className="min-w-8 tabular-nums">
                  <Link href={href(status, number)} aria-current={number === page ? "page" : undefined}>
                    {number}
                  </Link>
                </Button>
              </span>
            ))}
            <Button asChild size="sm" variant="outline" className={cn(page >= totalPages && "pointer-events-none opacity-50")}>
              <Link href={href(status, page + 1)} aria-label="الصفحة التالية">
                الأقدم
                <ChevronLeftIcon data-icon="inline-end" />
              </Link>
            </Button>
          </nav>
        ) : null}
      </div>
    </main>
  );
}
