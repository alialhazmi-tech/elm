import Link from "next/link";

import { SERIES } from "@/lib/content/series";
import { SECTION_NAMES } from "@/lib/content/seed";
import { stripHtmlToText } from "@/lib/content/html";
import { runPolicyGuard } from "@/lib/policy";
import { APPROVER_ROLES, getSession } from "@/lib/tahrir/auth";
import { editorHref } from "@/lib/tahrir/routes";
import {
  ACTIVE_STATUSES,
  bodiesFor,
  latestArchiveEvents,
  listPage,
  statusCounts,
  STATUS_LABELS,
  type StoryStatus,
} from "@/lib/tahrir/service";
import { ArchiveStoryButton, RestoreStoryButton } from "../../_components/archive-controls";
import { DeleteDraftButton } from "../../_components/delete-draft-button";

export const metadata = { title: "المواد" };
export const dynamic = "force-dynamic";

const PER_PAGE = 30;
const STATUS_PILLS: Record<StoryStatus, string> = {
  published: "pub",
  review: "rev",
  scheduled: "sch",
  draft: "dft",
  archived: "arc",
};
const seriesBySlug = new Map<string, (typeof SERIES)[number]>(
  SERIES.map((series) => [series.slug, series]),
);

const VALID_STATUSES = new Set<string>([...ACTIVE_STATUSES, "archived"]);

const archiveWhen = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; p?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const canArchive = session ? APPROVER_ROLES.includes(session.role) : false;
  const status = VALID_STATUSES.has(params.status ?? "")
    ? (params.status as StoryStatus)
    : undefined;
  const page = Math.max(1, Number(params.p) || 1);

  const [counts, rows] = await Promise.all([statusCounts(), listPage(status, page, PER_PAGE)]);
  const archivedCount = counts.archived ?? 0;
  const activeTotal = Object.entries(counts).reduce(
    (sum, [key, count]) => (key === "archived" ? sum : sum + count),
    0,
  );
  const filteredTotal = status ? (counts[status] ?? 0) : activeTotal;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PER_PAGE));
  const archiveEvents =
    status === "archived" ? await latestArchiveEvents(rows.map((row) => row.id)) : new Map();

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
          الكل <b>{activeTotal}</b>
        </Link>
        {ACTIVE_STATUSES.map((key) => (
          <Link key={key} className={`th-fch ${status === key ? "on" : ""}`} href={href(key)}>
            {STATUS_LABELS[key]} <b>{counts[key] ?? 0}</b>
          </Link>
        ))}
        <Link className={`th-fch ${status === "archived" ? "on" : ""}`} href={href("archived")}>
          مؤرشفة <b>{archivedCount}</b>
        </Link>
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
        const archived = archiveEvents.get(story.id);

        return (
          <div
            key={story.id}
            className="th-srow"
            style={{ "--sc": series?.color ?? "var(--t-line2)" } as React.CSSProperties}
          >
            <span className="rail" aria-hidden="true" />
            <Link className="th-srow-main" href={editorHref(story)}>
              <span className="t" style={{ display: "block" }}>
                {story.title}
              </span>
              <span className="m" style={{ display: "block" }}>
                {storyStatus === "archived" && archived ? (
                  <>
                    أُرشفت {archiveWhen(archived.at)}
                    {archived.actor ? ` · ${archived.actor}` : ""} — السبب: {archived.reason}
                  </>
                ) : (
                  <>
                    {story.authorName || SECTION_NAMES[story.section] || story.section} · حُدّثت{" "}
                    {(story.updatedAt ?? story.publishedAt ?? "").slice(0, 10) || "—"}
                  </>
                )}
              </span>
            </Link>
            <span className="chips">
              {series ? <span className="th-serchip">{series.name}</span> : null}
              {story.format === "jakalelm" ? <span className="th-report-badge">▦ جاك العلم</span> : null}
              <span className={`th-gchip ${chip.cls}`}>{chip.label}</span>
              <span className={`th-pill ${STATUS_PILLS[storyStatus] ?? "dft"}`}>
                {STATUS_LABELS[storyStatus] ?? story.status}
              </span>
              {storyStatus === "draft" ? <DeleteDraftButton id={story.id} title={story.title} /> : null}
              {canArchive && storyStatus !== "draft" && storyStatus !== "archived" ? (
                <ArchiveStoryButton id={story.id} title={story.title} />
              ) : null}
              {canArchive && storyStatus === "archived" ? (
                <RestoreStoryButton id={story.id} title={story.title} />
              ) : null}
            </span>
          </div>
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
