import type { Story } from "./types.ts";

type StoryPath = Pick<Story, "id" | "section" | "slug"> & { publicNumber?: number | null };

type CanonicalAlias = Pick<StoryPath, "id" | "section" | "slug">;

/** Verified duplicate-story aliases. Keep this list explicit and small. */
export const CANONICAL_STORY_ALIASES: Readonly<Record<string, CanonicalAlias>> = Object.freeze({
  "1658": {
    id: "1660",
    section: "world",
    slug: "خطط-دولية-ربما-تجبر-الشركات-الكبرى-على",
  },
});

/**
 * المعرّف الظاهر في الرابط: رقم الرابط العام لمواد اللوحة، وإلا المعرّف نفسه
 * (مواد ووردبريس رقمها هو معرّفها). المعرّف الداخلي يبقى للواجهات والتفاعلات.
 */
export function publicStoryId(story: Pick<StoryPath, "id" | "publicNumber">): string {
  return story.publicNumber ? String(story.publicNumber) : story.id;
}

function pathFor(story: StoryPath): string {
  return `/${story.section}/${publicStoryId(story)}/${story.slug}`;
}

/** The stored path, useful when deciding whether a request is an alias. */
export function storedStoryHref(story: StoryPath): string {
  return pathFor(story);
}

/** Returns the one canonical path for a story, including verified aliases. */
export function canonicalStoryHref(story: StoryPath): string {
  return pathFor(CANONICAL_STORY_ALIASES[story.id] ?? story);
}

/** رابط المشاركة القصير بلا سلاج؛ يحوّل 301 إلى الرابط الكامل فلا يطول بترميز العربية. */
export function shortStoryHref(story: StoryPath): string {
  const target = CANONICAL_STORY_ALIASES[story.id] ?? story;
  return `/${target.section}/${publicStoryId(target)}`;
}

export function isCanonicalStoryAliasId(id: string): boolean {
  return Object.hasOwn(CANONICAL_STORY_ALIASES, id);
}

export function isCanonicalStoryAlias(story: StoryPath): boolean {
  return isCanonicalStoryAliasId(story.id);
}
