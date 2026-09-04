/** الكلمات تحريرية صريحة؛ لا تُستخرج من العنوان أو تُدمج بحسب التشابه. */
export function storyKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string")
    .map((item) => item.trim()).filter(Boolean))];
}

export function keywordHref(keyword: string): string {
  return `/keywords/${encodeURIComponent(keyword.trim())}`;
}

/** هذه النسخة من Next تمرر مقطع المسار مرمزًا؛ نفكه مرة واحدة فقط. */
export function decodeKeywordParam(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}
