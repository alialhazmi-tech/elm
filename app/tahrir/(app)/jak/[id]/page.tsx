import Link from "next/link";
import { notFound } from "next/navigation";

import { SECTION_NAMES } from "@/lib/content/seed";
import { canEditStory, loadActor } from "@/lib/tahrir/access";
import { getJakSource, listSlides } from "@/lib/tahrir/jak";
import { getStory, latestArchiveEvents, listRecentMedia } from "@/lib/tahrir/service";
import { JakEditor } from "@/components/tahrir/jak/jak-editor";

export const metadata = { title: "جاك العلم" };
export const dynamic = "force-dynamic";

export default async function JakEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await loadActor();
  const story = await getStory(id).catch(() => null);
  if (!actor || !canEditStory(actor, story)) notFound();
  if (!story || story.format !== "jakalelm") notFound();

  const [slides, source, mediaRows] = await Promise.all([
    listSlides(id).catch(() => []),
    getJakSource(id).catch(() => ""),
    listRecentMedia({ rightsCleared: true, limit: 8 }).catch(() => []),
  ]);
  const archiveEvent =
    story.status === "archived" ? (await latestArchiveEvents([story.id])).get(story.id) : undefined;
  const recentMedia = mediaRows.map((row) => ({ url: row.url, filename: row.filename }));

  const sections = Object.entries(SECTION_NAMES).filter(([slug]) => slug !== "videos");

  return (
    <main className="flex flex-col gap-3">
      <Link className="inline-block text-sm underline" href={`/tahrir/history/${story.revisionOf ?? story.id}`}>سجل النسخ واستعادتها</Link>
      <JakEditor
        actorId={actor.userId}
        canApprove={actor?.can("story.publish") ?? false}
        sections={sections}
        recentMedia={recentMedia}
        initial={{
          id: story.id,
                version: story.version,
                revisionOf: story.revisionOf,
          title: story.title,
          excerpt: story.excerpt,
          section: story.section,
          slug: story.slug,
          status: story.status,
          slides,
          source,
          archiveEvent: archiveEvent ?? null,
        }}
      />
    </main>
  );
}
