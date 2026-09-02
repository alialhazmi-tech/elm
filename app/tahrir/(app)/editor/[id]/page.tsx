import { SERIES } from "@/lib/content/series";
import { redirect } from "next/navigation";
import { SECTION_NAMES } from "@/lib/content/seed";
import { loadActor } from "@/lib/tahrir/access";
import { getStory, latestArchiveEvents, listRecentMedia } from "@/lib/tahrir/service";
import { EditorClient } from "@/components/tahrir/editor/editor-client";

export const metadata = { title: "المحرر" };
export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await loadActor();
  const story = id === "new" ? null : await getStory(id).catch(() => null);
  if (story?.format === "jakalelm") redirect(`/tahrir/jak/${story.id}`);
  const archiveEvent = story?.status === "archived"
    ? (await latestArchiveEvents([story.id])).get(story.id)
    : undefined;
  const mediaRows = await listRecentMedia({ rightsCleared: true, limit: 6 }).catch(() => []);
  const recentMedia = mediaRows.map((row) => ({ url: row.url, filename: row.filename }));

  const sections = Object.entries(SECTION_NAMES).filter(([slug]) => slug !== "videos");

  return (
    <main>
      <EditorClient
        canApprove={actor?.can("story.publish") ?? false}
        recentMedia={recentMedia}
        series={SERIES.map(({ slug, name, color }) => ({ slug, name, color }))}
        sections={sections}
        initial={
          story
            ? {
                id: story.id,
                title: story.title,
                excerpt: story.excerpt,
                body: story.body,
                section: story.section,
                slug: story.slug,
                seriesSlug: story.seriesSlug,
                image: story.image,
                format: story.format,
                pinned: story.pinned === 1,
                breakingUntil: story.breakingUntil,
                status: story.status,
                seoTitle: story.seoTitle ?? "",
                seoDescription: story.seoDescription ?? "",
                keywords: Array.isArray(story.keywords) ? (story.keywords as string[]) : [],
                archiveEvent: archiveEvent ?? null,
              }
            : null
        }
      />
    </main>
  );
}
