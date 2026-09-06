import { notFound } from "next/navigation";
import ArticlePage, { generateMetadata as articleMetadata } from "@/app/[section]/[id]/[slug]/page";
import { seedContentProvider } from "@/lib/content/provider";

// صفحة مشاركة فعلية: لا يمر زاحف إكس بتحويل قديم مخزن لرابط المادة.
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string; version: string }> };

async function articleParams({ params }: Params) {
  const { id, version } = await params;
  if (!/^[a-z0-9_-]{1,64}$/i.test(id) || !/^\d{8}-\d{1,3}$/.test(version)) notFound();
  const story = await seedContentProvider.getStory(id);
  if (!story) notFound();
  return { params: Promise.resolve({ id: story.id, section: story.section, slug: story.slug }) };
}

export async function generateMetadata(props: Params) {
  return { ...await articleMetadata(await articleParams(props)), robots: { index: false, follow: true } };
}

export default async function SharePage(props: Params) {
  return ArticlePage(await articleParams(props));
}
