import {
  contentSource,
  listPublicSlides,
  listVisibleArchivedSeries,
  seedContentProvider,
  seriesOf,
} from "@/lib/content/provider";
import { SERIES } from "@/lib/content/series";
import { stripHtmlToText } from "@/lib/content/html";
import { absoluteMedia, toMobileCard, type MobileSeriesChip, type MobileStoryCard } from "@/lib/mobile/home";
import { forYouForMember } from "@/lib/personalization/recommend";
import { normalizeArabic } from "@/lib/policy/normalize";

export const MOBILE_STORY_CONTRACT = "mobile-story.v1";
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

export async function toMobileStory(id: string): Promise<MobileStoryPayload | null> {
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
      ? slideRows.map((row) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          body: row.body,
          stat: row.stat || null,
          statLabel: row.statLabel || null,
          image: absoluteMedia(row.image ?? undefined),
        }))
      : null;

  return {
    contract: MOBILE_STORY_CONTRACT,
    story: {
      ...toMobileCard(story),
      body: stripHtmlToText(story.body ?? story.excerpt),
      factCheck: story.factCheck ?? null,
    },
    series: series ? toChip(series) : null,
    related: related.map(toMobileCard),
    nextInSeries: nextInSeries ? toMobileCard(nextInSeries) : null,
    slides,
  };
}

async function toEntry(
  series: { slug: string; name: string; description: string; color: string; archived?: boolean },
): Promise<MobileSeriesEntry> {
  const stories = await seedContentProvider.listBySeries(series.slug);
  return {
    ...toChip(series),
    archived: Boolean(series.archived),
    count: stories.length,
    latest: stories[0] ? toMobileCard(stories[0]) : null,
  };
}

export async function toMobileSeriesIndex(): Promise<MobileSeriesIndexPayload> {
  const archived = await listVisibleArchivedSeries();
  return {
    contract: MOBILE_SERIES_INDEX_CONTRACT,
    series: await Promise.all(SERIES.map(toEntry)),
    archived: await Promise.all(archived.map(toEntry)),
  };
}

export async function toMobileSeriesFeed(slug: string): Promise<MobileSeriesFeedPayload | null> {
  const series = await seedContentProvider.getSeries(slug);
  if (!series) return null;
  const stories = await seedContentProvider.listBySeries(series.slug);
  return {
    contract: MOBILE_SERIES_FEED_CONTRACT,
    series: { ...toChip(series), archived: Boolean(series.archived) },
    stories: stories.map(toMobileCard),
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

export async function toMobileSearch(query: string): Promise<MobileSearchPayload> {
  const trimmed = query.trim();
  const needle = foldSearchText(trimmed);
  if (!needle) {
    return { contract: MOBILE_SEARCH_CONTRACT, query: trimmed, results: [], total: 0 };
  }

  const all = await seedContentProvider.listAll();
  const stories = all.filter((story) => {
    const haystack = foldSearchText(
      `${story.title} ${story.excerpt} ${story.eyebrow} ${(story.keywords ?? []).join(" ")}`,
    );
    return haystack.includes(needle);
  });

  return {
    contract: MOBILE_SEARCH_CONTRACT,
    query: trimmed,
    results: stories.slice(0, 40).map(toMobileCard),
    total: stories.length,
  };
}

export type MobileForYouItem = MobileStoryCard & { reason: string | null };

export type MobileForYouPayload = {
  contract: typeof MOBILE_FOR_YOU_CONTRACT;
  items: MobileForYouItem[];
};

export async function toMobileForYou(memberId: string, limit = 9): Promise<MobileForYouPayload> {
  const cards = await forYouForMember(memberId, limit);
  const all = await seedContentProvider.listAll();
  const byId = new Map(all.map((story) => [story.id, story]));
  const items = cards
    .map((card) => {
      const story = byId.get(card.id);
      if (!story) return null;
      return { ...toMobileCard(story), reason: card.reason?.text ?? null };
    })
    .filter((item): item is MobileForYouItem => Boolean(item));

  return { contract: MOBILE_FOR_YOU_CONTRACT, items };
}

export async function mobileHeaders(contract: string) {
  return {
    "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    "X-Content-Contract": contract,
    "X-Content-Source": await contentSource(),
  };
}
