/**
 * ملحقات مادة التطبيق (عقد v3): المتن الغني ككتل، الفيديو، الكلمات، الروابط، والبودكاست.
 * استيرادات نسبية عمدًا — الوحدة تدخل اختبارات node:test مباشرة بلا حزم ولا alias.
 */

import { looksLikeHtml, sanitizeBodyHtml, textToHtml } from "../content/html.ts";
import { keywordHref, storyKeywords } from "../content/keywords.ts";
import { readingOutline } from "../content/reading-outline.ts";
import { findVideoUrlInText, instagramPostUrlFrom, normalizeVideoUrl, videoEmbedUrl, xPostIdFrom, youtubeIdFrom } from "../content/video.ts";
import { fetchEpisodes, podcastShowFor, type PodcastEpisode, type PodcastShow } from "../podcasts.ts";
import { htmlToBlocks, type MobileBlock } from "./blocks.ts";
import { absoluteMedia } from "./origin.ts";

export type MobileVideoKind = "youtube" | "x" | "instagram";

export type MobileStoryBody = {
  bodyHtml: string;
  blocks: MobileBlock[];
  links: Array<{ href: string; label: string }>;
};

/** المتن المخزن (HTML منقّى أو نص إرثي) → HTML آمن + كتل + روابط المصادر. */
export function storyBody(body: string | undefined | null): MobileStoryBody {
  const raw = body ?? "";
  const bodyHtml = looksLikeHtml(raw) ? sanitizeBodyHtml(raw) : textToHtml(raw);
  return { bodyHtml, blocks: htmlToBlocks(bodyHtml), links: readingOutline(bodyHtml).links };
}

export type MobileStoryVideo = {
  videoUrl: string | null;
  videoEmbedUrl: string | null;
  videoKind: MobileVideoKind | null;
};

/** رابط الفيديو القياسي من الحقل أو من المتن، مع رابط التضمين ونوعه. */
export function storyVideo(story: { videoUrl?: string | null; body?: string | null }): MobileStoryVideo {
  const videoUrl = normalizeVideoUrl(story.videoUrl) ?? findVideoUrlInText(story.body);
  const videoKind: MobileVideoKind | null = !videoUrl
    ? null
    : youtubeIdFrom(videoUrl)
      ? "youtube"
      : xPostIdFrom(videoUrl)
        ? "x"
        : instagramPostUrlFrom(videoUrl)
          ? "instagram"
          : null;
  return { videoUrl, videoEmbedUrl: videoEmbedUrl(videoUrl), videoKind };
}

export type MobileKeyword = { keyword: string; href: string };

export function storyKeywordLinks(keywords: unknown): MobileKeyword[] {
  return storyKeywords(keywords).map((keyword) => ({ keyword, href: keywordHref(keyword) }));
}

export type MobilePodcastEpisode = {
  title: string;
  audioUrl: string;
  mime: string;
  publishedAt: string | null;
  duration: string | null;
  description: string;
  episode: string | null;
  season: string | null;
};

export type MobilePodcastShow = {
  storyId: string;
  name: string;
  cover: string | null;
  accent: string;
  youtube: string;
};

export type MobilePodcast = { show: MobilePodcastShow; episodes: MobilePodcastEpisode[] };

/** الحلقة كما في الخلاصة مع رابط صوت مطلق (الملفات المضيفة على `/podcast-audio/`). */
export function toMobileEpisode(episode: PodcastEpisode, origin: string): MobilePodcastEpisode {
  return {
    title: episode.title,
    audioUrl: absoluteMedia(episode.audioUrl, origin) ?? episode.audioUrl,
    mime: episode.mime,
    publishedAt: episode.publishedAt,
    duration: episode.duration,
    description: episode.description,
    episode: episode.episode,
    season: episode.season,
  };
}

export function toMobilePodcastShow(show: PodcastShow, origin: string, fallbackCover?: string | null): MobilePodcastShow {
  return {
    storyId: show.storyId,
    name: show.name,
    cover: absoluteMedia(show.cover ?? fallbackCover ?? undefined, origin),
    accent: show.accent,
    youtube: show.youtube,
  };
}

/** بودكاست مادة بشكل «بودكاست» لها برنامج مسجّل؛ فشل جلب الخلاصة يعطي حلقات فارغة لا خطأ. */
export async function storyPodcast(
  story: { id: string; format?: string | null; image?: string | null },
  origin: string,
  loadEpisodes: (show: PodcastShow) => Promise<PodcastEpisode[]> = fetchEpisodes,
): Promise<MobilePodcast | null> {
  if (story.format !== "podcasts") return null;
  const show = podcastShowFor(story.id);
  if (!show) return null;
  const episodes = await loadEpisodes(show).catch(() => [] as PodcastEpisode[]);
  return { show: toMobilePodcastShow(show, origin, story.image), episodes: episodes.map((episode) => toMobileEpisode(episode, origin)) };
}
