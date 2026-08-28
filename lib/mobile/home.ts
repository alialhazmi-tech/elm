import { SERIES } from "@/lib/content/series";
import {
  storyHref,
  type BriefItem,
  type HomeData,
  type NumberStat,
  type Story,
} from "@/lib/content/types";
import type { BreakingItem } from "@/lib/content/provider";
import { formatArticleDek } from "@/lib/format";
import { absoluteMedia, FALLBACK_SITE as SITE, MEDIA_WIDTH, optimizedMedia, requestOrigin } from "./origin";

export { absoluteMedia, MEDIA_WIDTH, optimizedMedia, requestOrigin };


export const MOBILE_HOME_CONTRACT = "mobile-home.v1";

export type MobileStoryCard = {
  id: string;
  slug: string;
  section: string;
  href: string;
  title: string;
  excerpt: string;
  eyebrow: string;
  readingMinutes: number;
  series: string | null;
  format: string | null;
  image: string | null;
  publishedAt: string | null;
};

export type MobileSeriesChip = {
  slug: string;
  name: string;
  description: string;
  color: string;
};

export type MobileHomePayload = {
  contract: typeof MOBILE_HOME_CONTRACT;
  generatedAt: string;
  breaking: BreakingItem | null;
  brief: BriefItem[];
  hero: MobileStoryCard | null;
  minis: MobileStoryCard[];
  mosaic: MobileStoryCard[];
  dataStory: MobileStoryCard | null;
  question: HomeData["question"];
  videos: MobileStoryCard[];
  numbers: NumberStat[];
  series: MobileSeriesChip[];
  mostRead: MobileStoryCard[];
};


export function toMobileCard(
  story: Story,
  origin: string = SITE,
  imageWidth: number = MEDIA_WIDTH.card,
): MobileStoryCard {
  return {
    id: story.id,
    slug: story.slug,
    section: story.section,
    href: storyHref(story),
    title: story.title,
    excerpt: formatArticleDek(story.excerpt),
    eyebrow: story.eyebrow,
    readingMinutes: story.readingMinutes,
    series: story.series ?? null,
    format: story.format ?? null,
    image: optimizedMedia(story.image, origin, imageWidth),
    publishedAt: story.publishedAt ?? null,
  };
}

export function toMobileHome(
  home: HomeData,
  breaking: BreakingItem | null,
  origin: string = SITE,
  generatedAt = new Date().toISOString(),
): MobileHomePayload {
  return {
    contract: MOBILE_HOME_CONTRACT,
    generatedAt,
    breaking,
    brief: home.brief,
    hero: home.hero ? toMobileCard(home.hero, origin, MEDIA_WIDTH.full) : null,
    minis: home.minis.map((story) => toMobileCard(story, origin)),
    mosaic: home.mosaic.map((story) => toMobileCard(story, origin)),
    dataStory: home.dataStory ? toMobileCard(home.dataStory, origin) : null,
    question: home.question,
    videos: home.videos.map((story) => toMobileCard(story, origin)),
    numbers: home.numbers,
    series: SERIES.map((item) => ({
      slug: item.slug,
      name: item.name,
      description: item.description,
      color: item.color,
    })),
    mostRead: home.mostRead.map((story) => toMobileCard(story, origin)),
  };
}
