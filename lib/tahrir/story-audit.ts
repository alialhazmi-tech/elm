/** Compact, lossless changes for the fields editors can persist. Never accepts client audit identity. */
export const STORY_FIELD_LABELS: Record<string, string> = {
  title: "العنوان", excerpt: "الموجز", body: "المتن", section: "القسم", slug: "الرابط", seriesSlug: "السلسلة",
  image: "صورة المادة", format: "شكل المادة", videoUrl: "رابط الفيديو", seoTitle: "عنوان SEO",
  seoDescription: "وصف SEO", keywords: "الكلمات المفتاحية", pinned: "التثبيت في الرئيسية", breakingUntil: "العاجل حتى",
  status: "حالة المادة", scheduledAt: "موعد النشر", publishedAt: "تاريخ النشر", boostedAt: "نبض الظهور", authorId: "الكاتب",
  authorName: "اسم الكاتب", assignedTo: "المحرر المسؤول", dueAt: "موعد التسليم", returnedAt: "الإعادة للتعديل",
  revisionOf: "المادة الأصلية", baseVersion: "نسخة الأصل", readingMinutes: "دقائق القراءة", eyebrow: "العنوان التمهيدي",
  factCheck: "التحقق من المعلومات", slides: "الشرائح", source: "النص المصدر",
};
export type TextChange = { kind: "text"; offset: number; removed: string; added: string; beforeLength: number; afterLength: number };
export type FieldChange = { field: string; label: string; before?: unknown; after?: unknown; text?: TextChange };
export type StoryAuditOptions = { before?: Record<string, unknown> | null; after?: Record<string, unknown>; rootStoryId?: string; saveMode?: "automatic" | "manual" };
export type StoryAuditContext = { v: 1; actorId: string | null; actorName: string; rootStoryId: string; changes: FieldChange[]; references?: Record<string, string>; saveMode?: "automatic" | "manual" };
export function fieldChanges(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> = {}): FieldChange[] {
  return Object.entries(after).flatMap<FieldChange>(([field, next]) => {
    if (!(field in STORY_FIELD_LABELS) || next === undefined) return [];
    const previous = before?.[field] ?? null, value = next ?? null;
    if (JSON.stringify(previous) === JSON.stringify(value)) return [];
    if (typeof previous === "string" && typeof value === "string" && Math.max(previous.length, value.length) > 500) {
      let start = 0, end = 0;
      while (start < previous.length && start < value.length && previous[start] === value[start]) start++;
      if (start > 0 && /[\uD800-\uDBFF]/.test(previous[start - 1])) start--;
      while (end < previous.length - start && end < value.length - start && previous[previous.length - end - 1] === value[value.length - end - 1]) end++;
      if (end > 0 && /[\uDC00-\uDFFF]/.test(previous[previous.length - end])) end--;
      return [{ field, label: STORY_FIELD_LABELS[field], text: { kind: "text" as const, offset: start, removed: previous.slice(start, previous.length - end), added: value.slice(start, value.length - end), beforeLength: previous.length, afterLength: value.length } }];
    }
    return [{ field, label: STORY_FIELD_LABELS[field], before: previous, after: value }];
  });
}
