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

export type FactCheck = {
  rumor: string;
  truth: string;
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
  /** بلوك الشائعة/الحقيقة لقالب «افهمها صح». */
  factCheck?: FactCheck;
};

export type NumberStat = {
  value: string;
  suffix?: string;
  label: string;
  href?: string;
};

export type BriefItem = {
  title: string;
  href: string;
  color: string;
};

/** حزمة الرئيسية بتوزيع «المنشور»: بنتو + فسيفساء + أرقام + مرئي. */
export type HomeData = {
  brief: BriefItem[];
  hero: Story;
  minis: Story[];
  dataStory: Story | null;
  mosaic: Story[];
  question: { kick: string; title: string; text: string; href: string } | null;
  videos: Story[];
  numbers: NumberStat[];
  series: Series[];
  /** مواد فريدة غير معروضة في البنتو/الفسيفساء/المرئي. */
  mostRead: Story[];
};

/** رابط المادة مطابق لبنية الإنتاج 1:1 — شرط الهجرة بلا فقد فهرسة. */
export function storyHref(story: Story): string {
  return `/${story.section}/${story.id}/${story.slug}`;
}

export interface ContentProvider {
  getHome(): Promise<HomeData>;
  getStory(id: string): Promise<Story | null>;
  getSeries(slug: string): Promise<Series | null>;
  listSeries(): Promise<Series[]>;
  listBySeries(slug: string): Promise<Story[]>;
  listBySection(section: string): Promise<Story[]>;
  listRelated(story: Story, limit?: number): Promise<Story[]>;
  listAll(): Promise<Story[]>;
  search(query: string): Promise<Story[]>;
}
