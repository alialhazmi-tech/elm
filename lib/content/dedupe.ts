import type { Story } from "./types";

export function takeUniqueStories(
  stories: readonly Story[],
  seen: Set<string>,
  limit: number,
): Story[] {
  const unique: Story[] = [];

  for (const story of stories) {
    if (seen.has(story.id)) continue;
    seen.add(story.id);
    unique.push(story);
    if (unique.length === limit) break;
  }

  return unique;
}

/**
 * المصوّر أولًا مع حفظ الترتيب داخل كل مجموعة.
 *
 * صفّ «مرئي وصوتي» في الرئيسية بطاقتان متجاورتان: بطاقة بلا غلاف تُرسم مستطيلًا
 * كحليًا فارغًا فيبدو الصفّ غير متوازن بجانب بطاقة مصوّرة. تقديم المصوّر يمنع ذلك،
 * وبقاء غير المصوّر في الذيل يحفظ صفًّا مكتملًا حين تقلّ الفيديوهات المصوّرة.
 */
export function preferWithImages(stories: readonly Story[]): Story[] {
  return [...stories.filter((story) => story.image), ...stories.filter((story) => !story.image)];
}
