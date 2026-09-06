/** نغيّر الإصدار عند تغيير إخراج البطاقة لتجاوز معاينات ما قبل نقل الموقع. */
export const SHARING_VERSION = "20260906-3";

export function sharingImageFit(story: { format?: string; section?: string }): "cover" | "contain" {
  return story.format === "infographics" || story.section === "infographics" || story.format === "jakalelm"
    ? "contain" : "cover";
}

/** رابط ثابت لكل إصدار، دون إفساد canonical أو إنشاء رابط جديد مع كل نقرة. */
export function refreshedShareUrl(value: string, origin?: string): string {
  const url = new URL(value, origin);
  url.searchParams.set("xcard", SHARING_VERSION);
  url.hash = "";
  return url.href;
}
