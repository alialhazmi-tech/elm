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

export interface ContentProvider {
  getHomeCandidates(): Promise<{
    hero: Story;
    sections: HomeBundle["sections"];
    series: Series[];
  }>;
}
