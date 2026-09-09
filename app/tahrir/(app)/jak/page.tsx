import Link from "next/link";

import { StatusPill } from "@/components/tahrir/badges";
import { Panel, PanelEmpty } from "@/components/tahrir/overview/panel";
import { SECTION_NAMES } from "@/lib/content/seed";
import { requireScreen } from "@/lib/tahrir/screen";
import { listLatestByFormat, listRecentMedia, STATUS_LABELS, type StoryStatus } from "@/lib/tahrir/service";
import { JakEditor } from "@/components/tahrir/jak/jak-editor";

export const metadata = { title: "جاك العلم" };
export const dynamic = "force-dynamic";

/** إنشاء جاك علم جديد — حقلان وزر واحد، والتعقيد كله بعد التحليل. */
export default async function JakNewPage() {
  const gate = await requireScreen("jak.manage", "جاك العلم");
  if (!gate.ok) return gate.element;
  const actor = gate.actor;
  const [mediaRows, jakStories] = await Promise.all([
    listRecentMedia({ rightsCleared: true, limit: 8 }).catch(() => []),
    listLatestByFormat("jakalelm", 30).catch(() => []),
  ]);
  const recentMedia = mediaRows.map((row) => ({ url: row.url, filename: row.filename }));

  const sections = Object.entries(SECTION_NAMES).filter(([slug]) => slug !== "videos");

  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">جاك العلم</h1>
        <span className="text-xs text-muted-foreground tabular-nums">{jakStories.length} مادة محفوظة</span>
      </div>
      <Panel title="مواد جاك العلم">
        {jakStories.length === 0 ? (
          <PanelEmpty>لا توجد مواد جاك محفوظة بعد — أنشئ أول مادة من النموذج أدناه.</PanelEmpty>
        ) : (
          jakStories.map((story) => (
            <Link
              key={story.id}
              href={`/tahrir/jak/${story.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-2.5 last:border-0 hover:bg-muted/60"
            >
              <span className="grid min-w-0 leading-tight">
                <span className="truncate text-[13px] font-semibold">{story.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  {SECTION_NAMES[story.section] || story.section} · حُدّثت {(story.updatedAt ?? story.publishedAt ?? "").slice(0, 10) || "—"}
                </span>
              </span>
              <StatusPill status={story.status} label={STATUS_LABELS[story.status as StoryStatus] ?? story.status} />
            </Link>
          ))
        )}
      </Panel>
      <JakEditor
        actorId={actor.userId}
        canApprove={actor.can("story.publish")}
        sections={sections}
        recentMedia={recentMedia}
        initial={null}
      />
    </main>
  );
}
