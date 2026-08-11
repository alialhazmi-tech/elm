import { notFound } from "next/navigation";

import { SECTION_NAMES } from "@/lib/content/seed";
import { getSession } from "@/lib/tahrir/auth";
import { getJakSource, listSlides } from "@/lib/tahrir/jak";
import { getStory, listMedia } from "@/lib/tahrir/service";
import { JakEditor } from "../../../_components/jak-editor";

export const metadata = { title: "جاك العلم" };
export const dynamic = "force-dynamic";

export default async function JakEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const story = await getStory(id).catch(() => null);
  if (!story || story.format !== "jakalelm") notFound();

  const [slides, source, mediaRows] = await Promise.all([
    listSlides(id).catch(() => []),
    getJakSource(id).catch(() => ""),
    listMedia().catch(() => []),
  ]);
  const recentMedia = mediaRows
    .filter((row) => row.rightsCleared === 1)
    .slice(0, 8)
    .map((row) => ({ url: row.url, filename: row.filename }));

  const sections = Object.entries(SECTION_NAMES).filter(([slug]) => slug !== "videos");

  return (
    <main className="th-screen">
      <JakEditor
        role={session?.role ?? "editor"}
        sections={sections}
        recentMedia={recentMedia}
        initial={{
          id: story.id,
          title: story.title,
          excerpt: story.excerpt,
          section: story.section,
          slug: story.slug,
          status: story.status,
          slides,
          source,
        }}
      />
    </main>
  );
}
