/** نغيّر الإصدار عند تغيير إخراج البطاقة لتجاوز معاينات ما قبل نقل الموقع. */
export const SHARING_VERSION = "20260908-1";

export function sharingImageFit(story: { format?: string; section?: string }): "cover" | "contain" {
  return story.format === "infographics" || story.section === "infographics" || story.format === "jakalelm"
    ? "contain" : "cover";
}

/** رابط ثابت لكل إصدار، دون إفساد canonical أو إنشاء رابط جديد مع كل نقرة. */
export function refreshedShareUrl(value: string, origin?: string): string {
  const url = new URL(value, origin);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 3 && /^[a-z0-9_-]{1,64}$/i.test(parts[1])) {
    url.pathname = `/share/${parts[1]}/${SHARING_VERSION}`;
    url.searchParams.delete("xcard");
  }
  url.hash = "";
  return url.href;
}
