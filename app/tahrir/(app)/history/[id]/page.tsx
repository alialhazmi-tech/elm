import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { storyVersions } from "@/db/schema";
import { canEditStory, loadActor } from "@/lib/tahrir/access";
import { getStory } from "@/lib/tahrir/service";
import { workflowDb } from "@/lib/tahrir/workflow";
import { HistoryRestore } from "@/components/tahrir/history-restore";
export const dynamic = "force-dynamic";
export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [actor, story] = await Promise.all([loadActor(), getStory(id)]);
  if (!actor || !story || !canEditStory(actor, story)) notFound();
  const versions = await workflowDb().select().from(storyVersions).where(eq(storyVersions.storyId, story.id)).orderBy(desc(storyVersions.version)).limit(100);
  return <main dir="rtl" className="mx-auto grid max-w-4xl gap-5 p-6">
    <Link href={`/tahrir/${story.format === "jakalelm" ? "jak" : "editor"}/${story.id}`}>العودة إلى المحرر</Link>
    <h1 className="text-2xl font-bold">سجل نسخ: {story.title}</h1>
    <p>النسخ المسجلة قبل كل اعتماد جديد. الاستعادة تنشئ مسودة وتتطلب اعتمادًا جديدًا.</p>
    {!versions.length && <p>لم تُسجّل نسخ سابقة بعد. يبدأ السجل من تفعيل هذه الخاصية.</p>}
    {versions.map(version => { const data = version.data as { story: { title: string; body: string } }; return <article key={version.id} className="grid gap-3 rounded-xl border p-5">
      <h2 className="font-bold">النسخة {version.version} · {data.story.title}</h2>
      <p>{version.createdAt} · {version.actor}</p>
      <details><summary>عرض النص السابق</summary><p className="whitespace-pre-wrap">{data.story.body.replace(/<[^>]*>/g, " ")}</p></details>
      {!story.revisionOf && ["published", "scheduled"].includes(story.status) && <HistoryRestore id={id} versionId={version.id} expectedVersion={story.version} />}
    </article>; })}
  </main>;
}
