/**
 * إبطال كاش ISR للموقع العام عند أي تغيير مؤثر على النشر — بلا انتظار الـ300 ثانية.
 * يُستدعى من Route Handlers فقط (revalidatePath يرفض العمل أثناء رندر مكوّن خادم).
 */

import { revalidatePath } from "next/cache";

export function revalidatePublicStory(story: { section: string; id: string; slug: string }) {
  try {
    revalidatePath(`/${story.section}/${story.id}/${story.slug}`);
    revalidatePath("/");
    revalidatePath(`/${story.section}`);
  } catch {
    // أفضل جهد — تعذّر الإبطال لا يُسقط طلب الحفظ/النشر، والكاش يصحّح نفسه خلال 300 ثانية.
  }
}
