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

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://alelm.net";

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
  hero: MobileStoryCard;
  minis: MobileStoryCard[];
  mosaic: MobileStoryCard[];
  dataStory: MobileStoryCard | null;
  question: HomeData["question"];
  videos: MobileStoryCard[];
  numbers: NumberStat[];
  series: MobileSeriesChip[];
  mostRead: MobileStoryCard[];
};

export function absoluteMedia(url: string | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${SITE}${path}`;
}

export function toMobileCard(story: Story): MobileStoryCard {
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
    image: absoluteMedia(story.image),
    publishedAt: story.publishedAt ?? null,
  };
}

export function toMobileHome(
  home: HomeData,
  breaking: BreakingItem | null,
  generatedAt = new Date().toISOString(),
): MobileHomePayload {
  return {
    contract: MOBILE_HOME_CONTRACT,
    generatedAt,
    breaking,
    brief: home.brief,
    hero: toMobileCard(home.hero),
    minis: home.minis.map(toMobileCard),
    mosaic: home.mosaic.map(toMobileCard),
    dataStory: home.dataStory ? toMobileCard(home.dataStory) : null,
    question: home.question,
    videos: home.videos.map(toMobileCard),
    numbers: home.numbers,
    series: SERIES.map((item) => ({
      slug: item.slug,
      name: item.name,
      description: item.description,
      color: item.color,
    })),
    mostRead: home.mostRead.map(toMobileCard),
  };
}
