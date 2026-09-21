/** إصدار اسم ملف صورة البطاقة؛ يُرفع عند تغيير إخراج الصورة كي لا تعيد المنصات نسخة مخزنة. */
export const SHARING_VERSION = "20260908-1";

export function sharingImageFit(story: { format?: string; section?: string }): "cover" | "contain" {
  return story.format === "infographics" || story.section === "infographics" || story.format === "jakalelm"
    ? "contain" : "cover";
}

/**
 * رابط المشاركة هو الرابط القانوني نفسه: رابط واحد لكل مادة في الأزرار والمحرر والتطبيق وog:url.
 * يُسقط معلمة `xcard` القديمة والمرساة، ويحفظ معاملات التتبع. مسارات /share/ القديمة يحوّلها الخادم 308.
 */
export function publicShareUrl(value: string, origin?: string): string {
  const url = new URL(value, origin);
  url.searchParams.delete("xcard");
  url.hash = "";
  return url.href;
}
