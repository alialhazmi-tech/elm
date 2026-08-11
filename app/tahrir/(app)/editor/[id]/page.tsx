import { SERIES } from "@/lib/content/series";
import { SECTION_NAMES } from "@/lib/content/seed";
import { getSession } from "@/lib/tahrir/auth";
import { getStory } from "@/lib/tahrir/service";
import { EditorClient } from "../../../_components/editor-client";

export const metadata = { title: "المحرر" };
export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const story = id === "new" ? null : await getStory(id).catch(() => null);

  const sections = Object.entries(SECTION_NAMES).filter(([slug]) => slug !== "videos");

  return (
    <main className="th-screen">
      <EditorClient
        role={session?.role ?? "editor"}
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
                status: story.status,
              }
            : null
        }
      />
    </main>
  );
}
