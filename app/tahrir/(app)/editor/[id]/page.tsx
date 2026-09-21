import { loadEditorialTaxonomy } from "@/lib/content/taxonomy-settings";
import { notFound, redirect } from "next/navigation";
import { canEditStory } from "@/lib/tahrir/access";
import { requireScreenActor } from "@/lib/tahrir/screen";
import { Forbidden } from "@/components/tahrir/forbidden";
import { getStory, latestArchiveEvents, listRecentMedia } from "@/lib/tahrir/service";
import { EditorClient } from "@/components/tahrir/editor/editor-client";
import { loadAiSettings } from "@/lib/ai/settings";

export const metadata = { title: "المحرر" };
export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireScreenActor();
  const settingsPromise = loadAiSettings();
  // صور المحرر تبدأ بمجرد وصول إعداد الحقوق، بالتوازي مع تحميل المادة والصلاحيات.
  const mediaPromise = settingsPromise.then(settings => listRecentMedia({
    rightsCleared: settings.governance.requireImageRights ? true : undefined,
    limit: 6,
  })).catch(() => []);
  // التصنيف في رحلة الجلب نفسها مع المادة والصلاحيات بدل رحلة رابعة بعدها.
  const [settings, story, taxonomy] = await Promise.all([
    settingsPromise,
    id === "new" ? Promise.resolve(null) : getStory(id),
    loadEditorialTaxonomy(),
  ]);
  if (id !== "new" && !story) notFound();
  if (!canEditStory(actor, story)) {
    return <Forbidden
      title="المحرر"
      permission={story ? "story.edit.any" : "story.create"}
      message={story ? "لا تملك صلاحية تعديل هذه المادة. اطلب من مسؤول النظام إسنادها إليك أو منحك صلاحية تعديل جميع المواد." : "لا تملك صلاحية إنشاء مادة جديدة."}
    />;
  }
  if (story?.format === "jakalelm") redirect(`/tahrir/jak/${story.id}`);
  const archiveEvent = story?.status === "archived"
    ? (await latestArchiveEvents([story.id])).get(story.id)
    : undefined;
  const mediaRows = await mediaPromise;
  const recentMedia = mediaRows.map((row) => ({ url: row.url, filename: row.filename }));

  const sections: Array<[string, string]> = taxonomy.sections.map(item => [item.slug, item.shortName || item.name]);

  return (
    <main>
      <EditorClient
        // A saved new draft updates its URL through history.replaceState; opening
        // "new" again must still get a fresh editor, even when this segment was new.
        key={id === "new" ? crypto.randomUUID() : id}
        actorId={actor.userId}
        canSubmit={actor.can("story.submit")}
        historyHref={story ? `/tahrir/history/${story.revisionOf ?? story.id}` : null}
        canApprove={actor?.can("story.publish") ?? false}
        canSchedule={actor.can("story.schedule")}
        canPin={actor.can("story.pin") || actor.can("story.publish")}
        guardControls={settings.governance}
        recentMedia={recentMedia}
        series={taxonomy.series.map(({ slug, name, color }) => ({ slug, name, color }))}
        sections={sections}
        initial={
          story
            ? {
                id: story.id,
                version: story.version,
                revisionOf: story.revisionOf,
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
                scheduledAt: story.scheduledAt,
                publishedAt: story.publishedAt,
                updatedAt: story.updatedAt,
                seoTitle: story.seoTitle ?? "",
                seoDescription: story.seoDescription ?? "",
                keywords: Array.isArray(story.keywords) ? (story.keywords as string[]) : [],
                videoUrl: story.videoUrl ?? null,
                archiveEvent: archiveEvent ?? null,
              }
            : null
        }
      />
    </main>
  );
}
