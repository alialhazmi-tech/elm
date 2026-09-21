import { canonicalStoryHref } from "./canonical-stories.ts";

export type SeriesSlug =
  | "absat"
  | "aghrab"
  | "efhamha-sah"
  | "bel-arqam"
  | "shakhsiat"
  | "limatha"
  | "matha-law"
  | "bel-tarikh"
  // سلاسل متقاعدة — صفحات أرشيف حية بقرار المالك (2026-08-11)
  | "qalu"
  | "taqarir"
  | "muwaththaq"
  | "matha-baad"
  | "elm-mondial";

export type Series = {
  slug: SeriesSlug;
  /** سلسلة متقاعدة: أرشيفها حي لكنها خارج حزام الاستكشاف. */
  archived?: boolean;
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
  /** شكل المادة (خبر/إنفوجرافيك/فيديو/تقرير/بودكاست) — منفصل عن الموضوع. */
  format?: string;
  /** متن المادة: نص فقرات (إرثي) أو HTML منقّى من محرر اللوحة — العرض يميز بينهما. */
  body?: string;
  /** عنوان SEO — يسقط للعنوان عند غيابه. */
  seoTitle?: string;
  /** وصف SEO — يسقط للموجز عند غيابه. */
  seoDescription?: string;
  /** كلمات مفتاحية للبحث وبيانات NewsArticle. */
  keywords?: string[];
  /** مثبتة في صدارة الرئيسية بقرار معتمد. */
  pinned?: boolean;
  /** عاجل حتى هذا الوقت (ISO) — بعده يختفي الشريط تلقائيًا. */
  breakingUntil?: string;
  image?: string;
  /** رابط يوتيوب أو تغريدة X لمواد شكل «فيديو» — يُعرض مشغّلًا مضمَّنًا بدل الصورة البارزة. */
  videoUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
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
  /** الموجز المنشور، لتجهيز النشرة الصوتية من المحتوى نفسه. */
  excerpt?: string;
  href: string;
  color: string;
  label: string;
  publishedAt?: string;
};

/** حزمة الرئيسية بتوزيع «المنشور»: بنتو + فسيفساء + أرقام + مرئي. */
export type HomeData = {
  brief: BriefItem[];
  /** عدد المواد المنشورة التي اختير منها الموجز — سطر الشفافية في «موجز العلم الذكي». */
  briefFrom: number;
  hero: Story | null;
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
  return canonicalStoryHref(story);
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
