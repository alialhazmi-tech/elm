import type { Story } from "./types.ts";

type StoryPath = Pick<Story, "id" | "section" | "slug">;

type CanonicalAlias = Pick<StoryPath, "id" | "section" | "slug">;

/** Verified duplicate-story aliases. Keep this list explicit and small. */
export const CANONICAL_STORY_ALIASES: Readonly<Record<string, CanonicalAlias>> = Object.freeze({
  "1658": {
    id: "1660",
    section: "world",
    slug: "خطط-دولية-ربما-تجبر-الشركات-الكبرى-على",
  },
});

function pathFor(story: StoryPath): string {
  return `/${story.section}/${story.id}/${story.slug}`;
}

/** The stored path, useful when deciding whether a request is an alias. */
export function storedStoryHref(story: StoryPath): string {
  return pathFor(story);
}

/** Returns the one canonical path for a story, including verified aliases. */
export function canonicalStoryHref(story: StoryPath): string {
  return pathFor(CANONICAL_STORY_ALIASES[story.id] ?? story);
}

export function isCanonicalStoryAliasId(id: string): boolean {
  return Object.hasOwn(CANONICAL_STORY_ALIASES, id);
}

export function isCanonicalStoryAlias(story: StoryPath): boolean {
  return isCanonicalStoryAliasId(story.id);
}
