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
