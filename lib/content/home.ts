import { takeUniqueStories } from "./dedupe";
import type { ContentProvider, HomeBundle, HomeSectionKey } from "./types";

/** سقف البطاقات لكل بلوك — «وراء الخبر» أوسع لأنه صدر الصفحة. */
const SECTION_LIMITS: Record<HomeSectionKey, number> = {
  behindNews: 6,
  infographic: 3,
  video: 3,
  podcast: 3,
};

export async function getHomeBundle(provider: ContentProvider): Promise<HomeBundle> {
  const candidates = await provider.getHomeCandidates();
  const seen = new Set<string>([candidates.hero.id]);

  return {
    hero: candidates.hero,
    series: candidates.series,
    sections: candidates.sections
      .map((section) => ({
        ...section,
        stories: takeUniqueStories(section.stories, seen, SECTION_LIMITS[section.key] ?? 3),
      }))
      .filter((section) => section.stories.length > 0),
  };
}
