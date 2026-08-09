export type SeriesSlug =
  | "absat"
  | "aghrab"
  | "efhamha-sah"
  | "bel-arqam"
  | "shakhsiat"
  | "limatha"
  | "matha-law"
  | "bel-tarikh"
  | "matha-baad";

export type Series = {
  slug: SeriesSlug;
  name: string;
  description: string;
  color: string;
};

export type Story = {
  id: string;
  slug: string;
  section: string;
  title: string;
  excerpt: string;
  eyebrow: string;
  readingMinutes: number;
  series?: SeriesSlug;
  image?: string;
  publishedAt?: string;
};

export type HomeSectionKey = "behindNews" | "video" | "podcast" | "infographic";

export type HomeBundle = {
  hero: Story;
  sections: Array<{
    key: HomeSectionKey;
    title: string;
    kicker: string;
    stories: Story[];
  }>;
  series: Series[];
};

/** رابط المادة مطابق لبنية الإنتاج 1:1 — شرط الهجرة بلا فقد فهرسة. */
export function storyHref(story: Story): string {
  return `/${story.section}/${story.id}/${story.slug}`;
}

export interface ContentProvider {
  getHomeCandidates(): Promise<{
    hero: Story;
    sections: HomeBundle["sections"];
    series: Series[];
  }>;
  getStory(id: string): Promise<Story | null>;
  getSeries(slug: string): Promise<Series | null>;
  listSeries(): Promise<Series[]>;
  listBySeries(slug: string): Promise<Story[]>;
  listBySection(section: string): Promise<Story[]>;
  listRelated(story: Story, limit?: number): Promise<Story[]>;
  listAll(): Promise<Story[]>;
  search(query: string): Promise<Story[]>;
}
