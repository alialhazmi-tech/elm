import Link from "next/link";

import { SERIES } from "@/lib/content/series";
import { SECTION_NAMES } from "@/lib/content/seed";
import { runPolicyGuard } from "@/lib/policy";
import { listForDashboard, STATUS_LABELS, type StoryStatus } from "@/lib/tahrir/service";

export const metadata = { title: "المواد" };
export const dynamic = "force-dynamic";

const STATUS_PILLS: Record<StoryStatus, string> = {
  published: "pub",
  review: "rev",
  scheduled: "sch",
  draft: "dft",
};
const seriesBySlug = new Map<string, (typeof SERIES)[number]>(
  SERIES.map((series) => [series.slug, series]),
);

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const rows = await listForDashboard().catch(() => []);

  const counts = {
    all: rows.length,
    published: rows.filter((row) => row.status === "published").length,
    review: rows.filter((row) => row.status === "review").length,
    scheduled: rows.filter((row) => row.status === "scheduled").length,
    draft: rows.filter((row) => row.status === "draft").length,
  };

  const filtered = status ? rows.filter((row) => row.status === status) : rows;

  return (
    <main className="th-screen">
      <div className="th-filters">
        <Link className={`th-fch ${!status ? "on" : ""}`} href="/tahrir/stories">
          الكل <b>{counts.all}</b>
        </Link>
        <Link
          className={`th-fch ${status === "published" ? "on" : ""}`}
          href="/tahrir/stories?status=published"
        >
          منشور <b>{counts.published}</b>
        </Link>
        <Link
          className={`th-fch ${status === "review" ? "on" : ""}`}
          href="/tahrir/stories?status=review"
        >
          بانتظار الاعتماد <b>{counts.review}</b>
        </Link>
        <Link
          className={`th-fch ${status === "scheduled" ? "on" : ""}`}
          href="/tahrir/stories?status=scheduled"
        >
          مجدول <b>{counts.scheduled}</b>
        </Link>
        <Link
          className={`th-fch ${status === "draft" ? "on" : ""}`}
          href="/tahrir/stories?status=draft"
        >
          مسودة <b>{counts.draft}</b>
        </Link>
      </div>

      {filtered.length === 0 && (
        <div className="th-panel">
          <div className="th-empty">لا مواد بهذه الحالة.</div>
        </div>
      )}

      {filtered.map((story) => {
        const series = story.seriesSlug ? seriesBySlug.get(story.seriesSlug) : undefined;
        const report = runPolicyGuard({ id: story.id, title: story.title, body: story.body });
        const chip =
          report.counts.blocking > 0
            ? { cls: "block", label: `${report.counts.blocking} قاطع` }
            : report.counts.warning > 0
              ? { cls: "warn", label: `${report.counts.warning} تحذير` }
              : { cls: "ok", label: "سليم" };
        const storyStatus = story.status as StoryStatus;

        return (
          <Link
            key={story.id}
            className="th-srow"
            href={`/tahrir/editor/${story.id}`}
            style={{ "--sc": series?.color ?? "var(--t-line2)" } as React.CSSProperties}
          >
            <span className="rail" />
            <span style={{ minWidth: 0 }}>
              <span className="t" style={{ display: "block" }}>
                {story.title}
              </span>
              <span className="m" style={{ display: "block" }}>
                {story.authorName || SECTION_NAMES[story.section] || story.section} · حُدّثت{" "}
                {(story.updatedAt ?? story.publishedAt ?? "").slice(0, 10) || "—"}
              </span>
            </span>
            {series ? <span className="th-serchip">{series.name}</span> : <span />}
            <span className={`th-gchip ${chip.cls}`}>{chip.label}</span>
            <span className={`th-pill ${STATUS_PILLS[storyStatus] ?? "dft"}`}>
              {STATUS_LABELS[storyStatus] ?? story.status}
            </span>
          </Link>
        );
      })}
    </main>
  );
}
