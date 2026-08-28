import {
  contentSource,
  listPublicSlides,
  listRecent,
  listVisibleArchivedSeries,
  seedContentProvider,
  seriesOf,
} from "@/lib/content/provider";
import { SERIES } from "@/lib/content/series";
import { stripHtmlToText } from "@/lib/content/html";
import { MEDIA_WIDTH, optimizedMedia, toMobileCard, type MobileSeriesChip, type MobileStoryCard } from "@/lib/mobile/home";
import { isReportPalette, REPORT_PALETTES, type ReportPalette, type SlideData } from "@/lib/tahrir/jak";
import { forYouForMember } from "@/lib/personalization/recommend";
import { normalizeArabic } from "@/lib/policy/normalize";

// v2: الشرائح تحمل بيانات نوعها كاملة (المقارنة والمسار والقائمة والاقتباس)
// وطابع التقرير اللوني — بلا ذلك يصل التقرير للتطبيق فارغًا من مادته.
export const MOBILE_STORY_CONTRACT = "mobile-story.v2";
export const MOBILE_SERIES_INDEX_CONTRACT = "mobile-series-index.v1";
export const MOBILE_SERIES_FEED_CONTRACT = "mobile-series-feed.v1";
export const MOBILE_SEARCH_CONTRACT = "mobile-search.v1";
export const MOBILE_FOR_YOU_CONTRACT = "mobile-for-you.v1";

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
    body: string;
    factCheck: { rumor: string; truth: string } | null;
  };
  series: MobileSeriesChip | null;
  related: MobileStoryCard[];
  nextInSeries: MobileStoryCard | null;
  slides: MobileSlide[] | null;
  jak: MobileJakReport | null;
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

  const slideRows = story.format === "jakalelm" ? await listPublicSlides(story.id) : [];
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
    },
    series: series ? toChip(series) : null,
    related: related.map((item) => toMobileCard(item, origin)),
    nextInSeries: nextInSeries ? toMobileCard(nextInSeries, origin) : null,
    slides,
    jak,
  };
}

/** الطابع اللوني مسطّحًا: التطبيق لا يعرف مفاتيح REPORT_PALETTES ولا يجب أن يعرفها. */
function jakReportOf(slideData: Array<SlideData | null>): MobileJakReport {
  const found = slideData.find((data) => isReportPalette(data?.palette))?.palette;
  const key: ReportPalette = isReportPalette(found) ? found : "economy";
  const palette = REPORT_PALETTES[key];
  return { palette: key, base: palette.base, base2: palette.base2, glow: palette.glow, glow2: palette.glow2 };
}

async function toEntry(
  series: { slug: string; name: string; description: string; color: string; archived?: boolean },
  origin?: string,
): Promise<MobileSeriesEntry> {
  const stories = await seedContentProvider.listBySeries(series.slug);
  return {
    ...toChip(series),
    archived: Boolean(series.archived),
    count: stories.length,
    latest: stories[0] ? toMobileCard(stories[0], origin) : null,
  };
}

export async function toMobileSeriesIndex(origin?: string): Promise<MobileSeriesIndexPayload> {
  const archived = await listVisibleArchivedSeries();
  return {
    contract: MOBILE_SERIES_INDEX_CONTRACT,
    series: await Promise.all(SERIES.map((item) => toEntry(item, origin))),
    archived: await Promise.all(archived.map((item) => toEntry(item, origin))),
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
    // max-age يخاطب كاش URLSession في التطبيق مباشرة — لا CDN أمام Railway
    // فقيمة s-maxage وحدها كانت حبرًا على ورق وكل دخول شاشة رحلة كاملة للأصل.
    "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=600",
    "X-Content-Contract": contract,
    "X-Content-Source": await contentSource(),
  };
}
