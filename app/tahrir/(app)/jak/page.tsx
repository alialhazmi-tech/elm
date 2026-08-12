import Link from "next/link";

import { SECTION_NAMES } from "@/lib/content/seed";
import { getSession } from "@/lib/tahrir/auth";
import { listLatestByFormat, listMedia, STATUS_LABELS, type StoryStatus } from "@/lib/tahrir/service";
import { JakEditor } from "../../_components/jak-editor";

export const metadata = { title: "جاك العلم" };
export const dynamic = "force-dynamic";

/** إنشاء جاك علم جديد — حقلان وزر واحد، والتعقيد كله بعد التحليل. */
export default async function JakNewPage() {
  const session = await getSession();
  const [mediaRows, jakStories] = await Promise.all([
    listMedia().catch(() => []),
    listLatestByFormat("jakalelm", 30).catch(() => []),
  ]);
  const recentMedia = mediaRows
    .filter((row) => row.rightsCleared === 1)
    .slice(0, 8)
    .map((row) => ({ url: row.url, filename: row.filename }));

  const sections = Object.entries(SECTION_NAMES).filter(([slug]) => slug !== "videos");

  return (
    <main className="th-screen">
      <section className="th-panel" style={{ marginBottom: 16 }}>
        <div className="hd">
          <h2>مواد جاك العلم</h2>
          <span className="mr">{jakStories.length} مادة محفوظة</span>
        </div>
        {jakStories.length === 0 ? (
          <div className="th-empty">لا توجد مواد جاك محفوظة بعد — أنشئ أول مادة من النموذج أدناه.</div>
        ) : (
          jakStories.map((story) => (
            <Link className="th-srow" key={story.id} href={`/tahrir/jak/${story.id}`}>
              <span className="rail" aria-hidden="true" />
              <span style={{ minWidth: 0 }}>
                <span className="t" style={{ display: "block" }}>{story.title}</span>
                <span className="m" style={{ display: "block" }}>
                  {SECTION_NAMES[story.section] || story.section} · حُدّثت {(story.updatedAt ?? story.publishedAt ?? "").slice(0, 10) || "—"}
                </span>
              </span>
              <span className="chips">
                <span className="th-report-badge">▦ جاك العلم</span>
                <span className={`th-pill ${story.status === "published" ? "pub" : story.status === "review" ? "rev" : story.status === "scheduled" ? "sch" : "dft"}`}>
                  {STATUS_LABELS[story.status as StoryStatus] ?? story.status}
                </span>
              </span>
            </Link>
          ))
        )}
      </section>
      <JakEditor
        role={session?.role ?? "editor"}
        sections={sections}
        recentMedia={recentMedia}
        initial={null}
      />
    </main>
  );
}
