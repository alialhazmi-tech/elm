import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { storyVersions } from "@/db/schema";
import { canEditStory, loadActor } from "@/lib/tahrir/access";
import { getStory } from "@/lib/tahrir/service";
import { workflowDb } from "@/lib/tahrir/workflow";
import { HistoryRestore } from "@/components/tahrir/history-restore";
import { HistorySnapshot } from "@/components/tahrir/history-snapshot";
export const dynamic = "force-dynamic";
export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [actor, story] = await Promise.all([loadActor(), getStory(id)]);
  if (!actor || !story || !canEditStory(actor, story)) notFound();
  // القائمة بأعمدة خفيفة والعنوان من اللقطة فقط؛ المتن الكامل يُحمّل عند فتح النسخة.
  const versions = await workflowDb()
    .select({ id: storyVersions.id, version: storyVersions.version, actor: storyVersions.actor, createdAt: storyVersions.createdAt, title: sql<string | null>`${storyVersions.data}->'story'->>'title'` })
    .from(storyVersions).where(eq(storyVersions.storyId, story.id)).orderBy(desc(storyVersions.version)).limit(100);
  return <main dir="rtl" className="mx-auto grid max-w-4xl gap-5 p-6">
    <Link href={`/tahrir/${story.format === "jakalelm" ? "jak" : "editor"}/${story.id}`}>العودة إلى المحرر</Link>
    <h1 className="text-2xl font-bold">سجل نسخ: {story.title}</h1>
    <p>النسخ المسجلة قبل كل اعتماد جديد. الاستعادة تنشئ مسودة وتتطلب اعتمادًا جديدًا.</p>
    {!versions.length && <p>لم تُسجّل نسخ سابقة بعد. يبدأ السجل من تفعيل هذه الخاصية.</p>}
    {versions.map(version => <article key={version.id} className="grid gap-3 rounded-xl border p-5">
      <h2 className="font-bold">النسخة {version.version} · {version.title ?? "بلا عنوان"}</h2>
      <p>{version.createdAt} · {version.actor}</p>
      <HistorySnapshot versionId={version.id} />
      {!story.revisionOf && ["published", "scheduled"].includes(story.status) && <HistoryRestore id={id} versionId={version.id} expectedVersion={story.version} />}
    </article>)}
  </main>;
}
