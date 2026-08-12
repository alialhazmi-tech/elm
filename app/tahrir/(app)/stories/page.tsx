import Link from "next/link";

import { SERIES } from "@/lib/content/series";
import { SECTION_NAMES } from "@/lib/content/seed";
import { stripHtmlToText } from "@/lib/content/html";
import { runPolicyGuard } from "@/lib/policy";
import { editorHref } from "@/lib/tahrir/routes";
import {
  bodiesFor,
  listPage,
  statusCounts,
  STATUS_LABELS,
  type StoryStatus,
} from "@/lib/tahrir/service";

export const metadata = { title: "المواد" };
export const dynamic = "force-dynamic";

const PER_PAGE = 30;
const STATUS_PILLS: Record<StoryStatus, string> = {
  published: "pub",
  review: "rev",
  scheduled: "sch",
  draft: "dft",
};
const seriesBySlug = new Map<string, (typeof SERIES)[number]>(
  SERIES.map((series) => [series.slug, series]),
);

const VALID_STATUSES = new Set(["published", "review", "scheduled", "draft"]);

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; p?: string }>;
}) {
  const params = await searchParams;
  const status = VALID_STATUSES.has(params.status ?? "")
    ? (params.status as StoryStatus)
    : undefined;
  const page = Math.max(1, Number(params.p) || 1);

  const [counts, rows] = await Promise.all([statusCounts(), listPage(status, page, PER_PAGE)]);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const filteredTotal = status ? (counts[status] ?? 0) : total;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PER_PAGE));

  // الحارس على المعروض فقط — لا على الأرشيف كله
  const bodies = await bodiesFor(rows.map((row) => row.id));

  const href = (targetStatus?: string, targetPage = 1) => {
    const query = new URLSearchParams();
    if (targetStatus) query.set("status", targetStatus);
    if (targetPage > 1) query.set("p", String(targetPage));
    const suffix = query.toString();
    return `/tahrir/stories${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <main className="th-screen">
      <div className="th-filters">
        <Link className={`th-fch ${!status ? "on" : ""}`} href={href()}>
          الكل <b>{total}</b>
        </Link>
        {(["published", "review", "scheduled", "draft"] as const).map((key) => (
          <Link key={key} className={`th-fch ${status === key ? "on" : ""}`} href={href(key)}>
            {STATUS_LABELS[key]} <b>{counts[key] ?? 0}</b>
          </Link>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="th-panel">
          <div className="th-empty">لا مواد بهذه الحالة.</div>
        </div>
      )}

      {rows.map((story) => {
        const series = story.seriesSlug ? seriesBySlug.get(story.seriesSlug) : undefined;
        const content = bodies.get(story.id);
        const report = content
          ? runPolicyGuard({
              id: story.id,
              title: content.title,
              body: stripHtmlToText(content.body),
              surface: story.format === "jakalelm" ? "design" : undefined,
            })
          : null;
        const chip = !report
          ? { cls: "ok", label: "—" }
          : report.counts.blocking > 0
            ? { cls: "block", label: `${report.counts.blocking} قاطع` }
            : report.counts.warning > 0
              ? { cls: "warn", label: `${report.counts.warning} تحذير` }
              : { cls: "ok", label: "سليم" };
        const storyStatus = story.status as StoryStatus;

        return (
          <Link
            key={story.id}
            className="th-srow"
            href={editorHref(story)}
            style={{ "--sc": series?.color ?? "var(--t-line2)" } as React.CSSProperties}
          >
            <span className="rail" aria-hidden="true" />
            <span style={{ minWidth: 0 }}>
              <span className="t" style={{ display: "block" }}>
                {story.title}
              </span>
              <span className="m" style={{ display: "block" }}>
                {story.authorName || SECTION_NAMES[story.section] || story.section} · حُدّثت{" "}
                {(story.updatedAt ?? story.publishedAt ?? "").slice(0, 10) || "—"}
              </span>
            </span>
            <span className="chips">
              {series ? <span className="th-serchip">{series.name}</span> : null}
              {story.format === "jakalelm" ? <span className="th-report-badge">▦ جاك العلم</span> : null}
              <span className={`th-gchip ${chip.cls}`}>{chip.label}</span>
              <span className={`th-pill ${STATUS_PILLS[storyStatus] ?? "dft"}`}>
                {STATUS_LABELS[storyStatus] ?? story.status}
              </span>
            </span>
          </Link>
        );
      })}

      {totalPages > 1 && (
        <div className="th-filters" style={{ marginTop: 14, justifyContent: "center" }}>
          {page > 1 && (
            <Link className="th-fch" href={href(status, page - 1)}>
              → الأحدث
            </Link>
          )}
          <span className="th-fch on">
            صفحة {page} من {totalPages}
          </span>
          {page < totalPages && (
            <Link className="th-fch" href={href(status, page + 1)}>
              الأقدم ←
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
