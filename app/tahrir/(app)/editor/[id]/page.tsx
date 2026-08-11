import { SERIES } from "@/lib/content/series";
import { SECTION_NAMES } from "@/lib/content/seed";
import { getSession } from "@/lib/tahrir/auth";
import { getStory, listMedia } from "@/lib/tahrir/service";
import { EditorClient } from "../../../_components/editor-client";

export const metadata = { title: "المحرر" };
export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const story = id === "new" ? null : await getStory(id).catch(() => null);
  const mediaRows = await listMedia().catch(() => []);
  const recentMedia = mediaRows
    .filter((row) => row.rightsCleared === 1)
    .slice(0, 6)
    .map((row) => ({ url: row.url, filename: row.filename }));

  const sections = Object.entries(SECTION_NAMES).filter(([slug]) => slug !== "videos");

  return (
    <main className="th-screen">
      <EditorClient
        role={session?.role ?? "editor"}
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
                status: story.status,
              }
            : null
        }
      />
    </main>
  );
}
