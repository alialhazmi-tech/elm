import Link from "next/link";
import { notFound } from "next/navigation";
import { requireScreen } from "@/lib/tahrir/screen";
import { canEditStory } from "@/lib/tahrir/access";
import { getStory } from "@/lib/tahrir/service";
import { listSlides, isLandscapeReport } from "@/lib/tahrir/jak";
import { JakReport } from "@/app/_components/jak-report";
import { JakStory } from "@/app/_components/jak-slides";
export const metadata = { title: "جاك العلم المحدثة — للقراءة" };
export const dynamic = "force-dynamic";
export default async function RetiredJakReport({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requireScreen("jak.manage", "جاك العلم المحدثة");
  if (!gate.ok) return gate.element;
  const story = await getStory((await params).id);
  if (!story || story.format !== "jakalelm" || !canEditStory(gate.actor, story)) notFound();
  const slides = await listSlides(story.id);
  return <main className="grid gap-4">
    <h1 className="text-xl font-bold">جاك العلم المحدثة — للقراءة فقط</h1>
    <p>القسم متوقف، ومحتوى هذا التقرير محفوظ دون تعديل.</p>
    <Link href="/tahrir/jak-reports">الانتقال إلى جاك العلم</Link>
    {isLandscapeReport(slides) ? <JakReport meta={{ title: story.title, sectionName: "جاك العلم المحدثة" }} slides={slides} /> : <JakStory meta={{ title: story.title, sectionName: "جاك العلم المحدثة", readingMinutes: story.readingMinutes, shareUrl: "", next: null }} slides={slides} />}
  </main>;
}
