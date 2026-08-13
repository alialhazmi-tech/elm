/**
 * إبطال كاش ISR للموقع العام عند أي تغيير مؤثر على النشر — بلا انتظار الـ300 ثانية.
 * يُستدعى من Route Handlers فقط (revalidatePath يرفض العمل أثناء رندر مكوّن خادم).
 */

import { revalidatePath } from "next/cache";

import { invalidateCorpus } from "@/lib/content/provider";

export function revalidatePublicStory(story: { section: string; id: string; slug: string }) {
  invalidateCorpus();
  try {
    revalidatePath(`/${story.section}/${story.id}/${story.slug}`);
    revalidatePath("/");
    revalidatePath(`/${story.section}`);
    revalidatePath("/series");
    revalidatePath("/search");
  } catch {
    // أفضل جهد — تعذّر الإبطال لا يُسقط طلب الحفظ/النشر، والكاش يصحّح نفسه خلال 300 ثانية.
  }
}
