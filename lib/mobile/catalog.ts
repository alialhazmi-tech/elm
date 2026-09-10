import { PUBLIC_CONTENT_CACHE_CONTROL } from "@/lib/content/cache-policy";
import {
  contentSource,
  listByFormat,
  listPublicSlides,
  listRecent,
  listVisibleArchivedSeries,
  pageByKeyword,
  seedContentProvider,
  seriesOf,
  seriesDirectory,
} from "@/lib/content/provider";
import { SERIES } from "@/lib/content/series";
import { stripHtmlToText } from "@/lib/content/html";
import { decodeKeywordParam } from "@/lib/content/keywords";
import { MEDIA_WIDTH, optimizedMedia, toMobileCard, type MobileSeriesChip, type MobileStoryCard } from "@/lib/mobile/home";
import type { MobileBlock } from "@/lib/mobile/blocks";
import {
  storyBody,
  storyKeywordLinks,
  storyPodcast,
  storyVideo,
  toMobileEpisode,
  toMobilePodcastShow,
  type MobileKeyword,
  type MobilePodcast,
  type MobilePodcastEpisode,
  type MobilePodcastShow,
  type MobileVideoKind,
} from "@/lib/mobile/story-extras";
import { fetchEpisodes, PODCAST_SHOWS } from "@/lib/podcasts";
import { isReportPalette, REPORT_PALETTES, type ReportPalette, type SlideData } from "@/lib/tahrir/jak";
import { forYouForMember } from "@/lib/personalization/recommend";
import { normalizeArabic } from "@/lib/policy/normalize";
import { FALLBACK_SITE as SITE } from "@/lib/mobile/origin";

// v2: الشرائح تحمل بيانات نوعها كاملة (المقارنة والمسار والقائمة والاقتباس)
// وطابع التقرير اللوني — بلا ذلك يصل التقرير للتطبيق فارغًا من مادته.
// v3 (2026-09-10): المتن الغني ككتل + HTML منقّى، الفيديو بنوعه، الكلمات، روابط المصادر، والبودكاست —
// بلا حذف لأي حقل من v2؛ `story.body` يبقى نصًا خالصًا للعملاء القديمة.
export const MOBILE_STORY_CONTRACT = "mobile-story.v3";
export const MOBILE_SERIES_INDEX_CONTRACT = "mobile-series-index.v1";
export const MOBILE_SERIES_FEED_CONTRACT = "mobile-series-feed.v1";
export const MOBILE_SEARCH_CONTRACT = "mobile-search.v1";
export const MOBILE_FOR_YOU_CONTRACT = "mobile-for-you.v1";
export const MOBILE_PODCASTS_CONTRACT = "mobile-podcasts.v1";
export const MOBILE_KEYWORDS_CONTRACT = "mobile-keywords.v1";
export const MOBILE_JAK_CONTRACT = "mobile-jak.v1";

export type MobileSlide = {
  id: string;
  type: string;
  title: string;
  body: string;
  stat: string | null;
  statLabel: string | null;
  image: string | null;
  /** سطر تصنيفي قصير فوق العنوان. */
  eyebrow: string | null;
  /** جهة العنصر البصري والمساحة الهادئة — يوجّهان موضع النص فوق الصورة. */
  focal: "left" | "center" | "right" | null;
  textSide: "left" | "center" | "right" | null;
  /** مقارنة: طرفان. */
  sides: Array<{ label: string; value: string }> | null;
  /** تسلسل زمني: محطات. */
  points: Array<{ year: string; title: string; detail: string }> | null;
  /** قائمة: عناصر. */
  items: string[] | null;
  /** اقتباس: النسبة. */
  quoteBy: string | null;
};

/** طابع التقرير اللوني — أربعة ألوان تُلوّن القارئ الغامر كله. */
export type MobileJakReport = {
  palette: string;
  base: string;
  base2: string;
  glow: string;
  glow2: string;
};

export type MobileStoryPayload = {
  contract: typeof MOBILE_STORY_CONTRACT;
  story: MobileStoryCard & {
    /** نص خالص (v2) — للعملاء القديمة ولمشاركة النص. */
    body: string;
    factCheck: { rumor: string; truth: string } | null;
    /** HTML منقّى بالوسوم المسموحة فقط (v3). */
    bodyHtml: string;
    /** المتن ككتل حتمية بلا HTML (v3). */
    blocks: MobileBlock[];
    videoUrl: string | null;
    videoEmbedUrl: string | null;
    videoKind: MobileVideoKind | null;
    keywords: MobileKeyword[];
    links: Array<{ href: string; label: string }>;
    updatedAt: string | null;
    seoDescription: string | null;
  };
  series: MobileSeriesChip | null;
  related: MobileStoryCard[];
  nextInSeries: MobileStoryCard | null;
  slides: MobileSlide[] | null;
  jak: MobileJakReport | null;
  /** برنامج البودكاست وحلقاته لمواد شكل «بودكاست» المسجّلة؛ null لغيرها. */
  podcast: MobilePodcast | null;
};

export type MobileSeriesEntry = MobileSeriesChip & {
  archived: boolean;
  count: number;
  latest: MobileStoryCard | null;
};

export type MobileSeriesIndexPayload = {
  contract: typeof MOBILE_SERIES_INDEX_CONTRACT;
  series: MobileSeriesEntry[];
  archived: MobileSeriesEntry[];
};

export type MobileSeriesFeedPayload = {
  contract: typeof MOBILE_SERIES_FEED_CONTRACT;
  series: MobileSeriesChip & { archived: boolean };
  stories: MobileStoryCard[];
  total: number;
};

function toChip(series: { slug: string; name: string; description: string; color: string }): MobileSeriesChip {
  return {
    slug: series.slug,
    name: series.name,
    description: series.description,
    color: series.color,
  };
}

export async function toMobileStory(id: string, origin?: string): Promise<MobileStoryPayload | null> {
  const story = await seedContentProvider.getStory(id);
  if (!story) return null;

  const related = await seedContentProvider.listRelated(story, 3);
  const series = seriesOf(story);
  const nextInSeries = series
    ? related.find((item) => item.series === series.slug) ?? null
    : null;

  const [slideRows, podcast] = await Promise.all([
    story.format === "jakalelm" ? listPublicSlides(story.id) : Promise.resolve([]),
    storyPodcast(story, origin ?? SITE),
  ]);
  const body = storyBody(story.body ?? story.excerpt);
  const slides: MobileSlide[] | null =
    slideRows.length > 0
      ? slideRows.map((row) => {
          const data = (row.data ?? null) as SlideData | null;
          return {
            id: row.id,
            type: row.type,
            title: row.title,
            body: row.body,
            stat: row.stat || null,
            statLabel: row.statLabel || null,
            image: optimizedMedia(row.image ?? undefined, origin, MEDIA_WIDTH.full),
            eyebrow: data?.eyebrow || null,
            focal: data?.focalPoint ?? null,
            textSide: data?.textSafeArea ?? null,
            sides: data?.sides?.length ? data.sides : null,
            points: data?.points?.length ? data.points : null,
            items: data?.items?.length ? data.items : null,
            quoteBy: data?.quoteBy || null,
          };
        })
      : null;
  const jak: MobileJakReport | null =
    slideRows.length > 0
      ? jakReportOf(slideRows.map((row) => (row.data ?? null) as SlideData | null))
      : null;

  return {
    contract: MOBILE_STORY_CONTRACT,
    story: {
      ...toMobileCard(story, origin, MEDIA_WIDTH.full),
      body: stripHtmlToText(story.body ?? story.excerpt),
      factCheck: story.factCheck ?? null,
      bodyHtml: body.bodyHtml,
      blocks: body.blocks,
      ...storyVideo(story),
      keywords: storyKeywordLinks(story.keywords),
      links: body.links,
      updatedAt: story.updatedAt ?? null,
      seoDescription: story.seoDescription ?? null,
    },
    series: series ? toChip(series) : null,
    related: related.map((item) => toMobileCard(item, origin)),
    nextInSeries: nextInSeries ? toMobileCard(nextInSeries, origin) : null,
    slides,
    jak,
    podcast,
  };
}

export type MobilePodcastsPayload = {
  contract: typeof MOBILE_PODCASTS_CONTRACT;
  shows: Array<MobilePodcastShow & { href: string | null; episodes: MobilePodcastEpisode[] }>;
};

/** برامج البودكاست كلها بحلقاتها — الغلاف من البرنامج أو من صورة مادته؛ فشل خلاصة يعطي حلقات فارغة. */
export async function toMobilePodcasts(origin?: string): Promise<MobilePodcastsPayload> {
  const shows = await Promise.all(
    PODCAST_SHOWS.map(async (show) => {
      const [story, episodes] = await Promise.all([
        seedContentProvider.getStory(show.storyId).catch(() => null),
        fetchEpisodes(show).catch(() => []),
      ]);
      return {
        ...toMobilePodcastShow(show, origin ?? SITE, story?.image),
        href: story ? toMobileCard(story, origin).href : null,
        episodes: episodes.map((episode) => toMobileEpisode(episode, origin ?? SITE)),
      };
    }),
  );
  return { contract: MOBILE_PODCASTS_CONTRACT, shows };
}

export type MobileKeywordsPayload = {
  contract: typeof MOBILE_KEYWORDS_CONTRACT;
  keyword: string;
  stories: MobileStoryCard[];
  total: number;
  page: number;
  nextPage: number | null;
};

/** أرشيف كلمة مفتاحية صريحة بترقيم الويب نفسه؛ null لكلمة بلا مواد منشورة. */
export async function toMobileKeywords(rawKeyword: string, page: string | null, origin?: string): Promise<MobileKeywordsPayload | null> {
  const keyword = decodeKeywordParam(rawKeyword).trim();
  if (!keyword || keyword.length > 80) return null;
  const result = await pageByKeyword(keyword, page);
  if (result.total === 0) return null;
  return {
    contract: MOBILE_KEYWORDS_CONTRACT,
    keyword,
    stories: result.items.map((item) => toMobileCard(item, origin)),
    total: result.total,
    page: result.page,
    nextPage: result.page < result.pageCount ? result.page + 1 : null,
  };
}

export type MobileJakPayload = { contract: typeof MOBILE_JAK_CONTRACT; stories: MobileStoryCard[] };

export const MOBILE_JAK_MAX = 60;

/** تقارير جاك العلم المنشورة — بطاقات فقط؛ التقرير نفسه يُفتح عبر story/:id. */
export async function toMobileJak(rawLimit: string | null, origin?: string): Promise<MobileJakPayload> {
  const parsed = Number.parseInt(rawLimit ?? "", 10);
  const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(MOBILE_JAK_MAX, parsed) : 40;
  const stories = await listByFormat("jakalelm", limit);
  return { contract: MOBILE_JAK_CONTRACT, stories: stories.map((item) => toMobileCard(item, origin)) };
}

/** الطابع اللوني مسطّحًا: التطبيق لا يعرف مفاتيح REPORT_PALETTES ولا يجب أن يعرفها. */
function jakReportOf(slideData: Array<SlideData | null>): MobileJakReport {
  const found = slideData.find((data) => isReportPalette(data?.palette))?.palette;
  const key: ReportPalette = isReportPalette(found) ? found : "economy";
  const palette = REPORT_PALETTES[key];
  return { palette: key, base: palette.base, base2: palette.base2, glow: palette.glow, glow2: palette.glow2 };
}

export async function toMobileSeriesIndex(origin?: string): Promise<MobileSeriesIndexPayload> {
  const [archived, directory] = await Promise.all([listVisibleArchivedSeries(), seriesDirectory()]);
  const entry = (series: { slug: string; name: string; description: string; color: string; archived?: boolean }): MobileSeriesEntry => ({
    ...toChip(series),
    archived: Boolean(series.archived),
    count: directory[series.slug]?.count ?? 0,
    latest: directory[series.slug]?.latest ? toMobileCard(directory[series.slug].latest!, origin) : null,
  });
  return {
    contract: MOBILE_SERIES_INDEX_CONTRACT,
    series: SERIES.map(entry),
    archived: archived.map(entry),
  };
}

export async function toMobileSeriesFeed(slug: string, origin?: string): Promise<MobileSeriesFeedPayload | null> {
  const series = await seedContentProvider.getSeries(slug);
  if (!series) return null;
  const stories = await seedContentProvider.listBySeries(series.slug);
  return {
    contract: MOBILE_SERIES_FEED_CONTRACT,
    series: { ...toChip(series), archived: Boolean(series.archived) },
    stories: stories.map((item) => toMobileCard(item, origin)),
    total: stories.length,
  };
}

const AL_PREFIX = /^(وال|فال|بال|كال|ال|لل)/;

/** تطبيع همزات وتشكيل ثم نزع «الـ» من كل كلمة — للبحث فقط. */
export function foldSearchText(input: string): string {
  return normalizeArabic(input)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(AL_PREFIX, ""))
    .join(" ");
}

export type MobileSearchPayload = {
  contract: typeof MOBILE_SEARCH_CONTRACT;
  query: string;
  results: MobileStoryCard[];
  total: number;
};

export async function toMobileSearch(query: string, origin?: string): Promise<MobileSearchPayload> {
  const trimmed = query.trim();
  const needle = foldSearchText(trimmed);
  if (!needle) {
    return { contract: MOBILE_SEARCH_CONTRACT, query: trimmed, results: [], total: 0 };
  }

  // البحث في SQL عبر المزود: نفس التطبيع (همزات/تشكيل/نزع «الـ») على كامل الأرشيف،
  // لا على نافذة الذاكرة — فالمواد القديمة تبقى قابلة للعثور.
  const stories = await seedContentProvider.search(trimmed);

  return {
    contract: MOBILE_SEARCH_CONTRACT,
    query: trimmed,
    results: stories.slice(0, 40).map((item) => toMobileCard(item, origin)),
    total: stories.length,
  };
}

export type MobileForYouItem = MobileStoryCard & { reason: string | null };

export type MobileForYouPayload = {
  contract: typeof MOBILE_FOR_YOU_CONTRACT;
  items: MobileForYouItem[];
};

export async function toMobileForYou(memberId: string, limit = 9, origin?: string): Promise<MobileForYouPayload> {
  const cards = await forYouForMember(memberId, limit);
  const all = await listRecent(400);
  const byId = new Map(all.map((story) => [story.id, story]));
  const items = cards
    .map((card) => {
      const story = byId.get(card.id);
      if (!story) return null;
      return { ...toMobileCard(story, origin), reason: card.reason?.text ?? null };
    })
    .filter((item): item is MobileForYouItem => Boolean(item));

  return { contract: MOBILE_FOR_YOU_CONTRACT, items };
}

export async function mobileHeaders(contract: string) {
  return {
    // الكاش الخادمي يُبطل عند النشر؛ التطبيق يعيد التحقق قبل استخدام نسخة محفوظة.
    "Cache-Control": PUBLIC_CONTENT_CACHE_CONTROL,
    "X-Content-Contract": contract,
    "X-Content-Source": await contentSource(),
  };
}
