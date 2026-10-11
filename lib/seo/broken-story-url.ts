/**
 * روابط مواد تالفة تصل من المشاركة أو الزواحف: عنوان مقتطع في منتصف حرف عربي
 * (ترميز % ناقص يُسقطه Next بخطأ 400)، أو عنوان رُمّز مرتين فيُفك نصًا مشوّهًا
 * (Ø§Ù...) يطول حتى يتجاوز حد اسم الملف حين يحفظ Next نسخة الصفحة.
 * الحل: تحويل الطلب إلى الرابط القصير /القسم/الرقم الذي يحسم الرابط الصحيح.
 */

const STORY_PATH = /^\/([a-z][a-z0-9-]{0,40})\/(\d{1,12})\/([^/]+)\/?$/;

/** بايت UTF-8 قائد يليه بايت تابع، مقروءين كحروف Latin-1: علامة ترميز مزدوج. */
const DOUBLE_ENCODED = /[Â-ô][\u0080-¿]/;

/** يعيد الرابط القصير البديل إن كان مقطع العنوان تالفًا، وإلا null. */
export function brokenStoryRedirect(pathname: string): string | null {
  const match = STORY_PATH.exec(pathname);
  if (!match) return null;
  const [, section, id, slug] = match;
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return `/${section}/${id}`;
  }
  return DOUBLE_ENCODED.test(decoded) ? `/${section}/${id}` : null;
}
