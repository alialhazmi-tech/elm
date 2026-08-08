import { takeUniqueStories } from "./dedupe";
import type { ContentProvider, HomeBundle } from "./types";

export async function getHomeBundle(provider: ContentProvider): Promise<HomeBundle> {
  const candidates = await provider.getHomeCandidates();
  const seen = new Set<string>([candidates.hero.id]);

  return {
    hero: candidates.hero,
    series: candidates.series,
    sections: candidates.sections.map((section) => ({
      ...section,
      stories: takeUniqueStories(section.stories, seen, 3),
    })),
  };
}
