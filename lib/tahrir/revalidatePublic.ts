/**
 * إبطال البيانات وISR بعد نجاح تغيير منشور؛ أول طلب تالٍ يقرأ النسخة الجديدة.
 * يُستدعى من Route Handlers فقط (revalidatePath يرفض العمل أثناء رندر مكوّن خادم).
 */

import { revalidatePath } from "next/cache";

import { invalidateCorpus } from "@/lib/content/provider";

export function revalidatePublicStory(story: { section: string; id: string; slug: string; publicNumber?: number | null }) {
  revalidatePublicContent();
  revalidatePath(`/${story.section}/${story.id}/${story.slug}`);
  if (story.publicNumber) revalidatePath(`/${story.section}/${story.publicNumber}/${story.slug}`);
}

export function revalidatePublicContent() {
  invalidateCorpus();
  // شريط الأخبار والمواد المرتبطة موجودان أيضًا خارج صفحة المادة وقسمها.
  // الأنماط تشمل الصفحات المرقّمة والمواد التي تغيّرت كلماتها أو سلسلتها.
  for (const path of ["/", "/series", "/search", "/jak", "/podcasts", "/sitemap.xml", "/sitemap-news.xml", "/sitemap-videos.xml"]) {
    revalidatePath(path);
  }
  revalidatePath("/[section]", "page");
  revalidatePath("/[section]/[id]/[slug]", "page");
  revalidatePath("/series/[slug]", "page");
  revalidatePath("/keywords/[keyword]", "page");
}
