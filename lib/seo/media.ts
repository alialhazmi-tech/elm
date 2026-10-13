import { createHash } from "node:crypto";
import type { Story } from "../content/types.ts";
import { videoEmbedUrl, youtubeIdFrom } from "../content/video.ts";
import { presentEpisode, type PodcastEpisode, type PodcastShow } from "../podcasts.ts";
import { cleanMetadataText } from "./metadata.ts";
import { ORGANIZATION_ID, PUBLIC_SITE_URL } from "./schema.ts";

function publicUrl(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value, PUBLIC_SITE_URL);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

function dateValue(value: string | null | undefined): string | undefined {
  const date = Date.parse(value ?? "");
  return Number.isFinite(date) ? new Date(date).toISOString() : undefined;
}

/** Stable links to the rendered episode, independent of list order. */
export function podcastEpisodeAnchor(audioUrl: string): string {
  return `episode-${createHash("sha256").update(publicUrl(audioUrl) ?? audioUrl).digest("hex").slice(0, 16)}`;
}

export function podcastDurationIso(raw: string | null): string | undefined {
  if (!raw || !/^\d+(?::\d{1,2}){0,2}$/.test(raw.trim())) return undefined;
  const parts = raw.trim().split(":").map(Number);
  if (parts.slice(1).some((part) => part >= 60)) return undefined;
  const seconds = parts.reduce((sum, part) => sum * 60 + part, 0);
  return Number.isSafeInteger(seconds) && seconds > 0 ? `PT${seconds}S` : undefined;
}

export function podcastStructuredData(input: {
  show: PodcastShow; episodes: PodcastEpisode[]; canonicalUrl: string;
  cover?: string | null; description?: string | null;
}) {
  const { show, canonicalUrl } = input;
  const seriesId = `${canonicalUrl}#podcast`;
  const image = publicUrl(input.cover);
  const episodes = input.episodes.flatMap((episode) => {
    const audio = publicUrl(episode.audioUrl);
    const presented = presentEpisode(episode.title, show.name, episode.description, episode.guest);
    const name = cleanMetadataText(presented.title);
    if (!audio || !name) return [];
    const id = `${canonicalUrl}#${podcastEpisodeAnchor(episode.audioUrl)}`;
    const duration = podcastDurationIso(episode.duration);
    return [{
      "@type": "PodcastEpisode", "@id": id, url: id, name,
      description: cleanMetadataText(episode.description) || undefined,
      datePublished: dateValue(episode.publishedAt),
      episodeNumber: episode.episode && /^\d+$/.test(episode.episode) ? episode.episode : undefined,
      timeRequired: duration,
      partOfSeries: { "@id": seriesId },
      publisher: { "@id": ORGANIZATION_ID },
      associatedMedia: {
        "@type": "AudioObject", contentUrl: audio,
        encodingFormat: /^audio\/[\w.+-]+$/.test(episode.mime) ? episode.mime : undefined,
        duration,
      },
    }];
  });
  return {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "PodcastSeries", "@id": seriesId, url: canonicalUrl,
      name: cleanMetadataText(show.name),
      description: cleanMetadataText(input.description) || undefined,
      ...(image ? { image } : {}),
      publisher: { "@id": ORGANIZATION_ID },
      webFeed: publicUrl(show.feedUrl),
      episode: episodes.map((episode) => ({ "@id": episode["@id"] })),
    }, ...episodes],
  };
}

/** Only the YouTube video actually displayed by the article's video template. */
export function videoStructuredData(story: Pick<Story, "format" | "videoUrl" | "title" | "excerpt" | "publishedAt">, canonicalUrl: string) {
  if (story.format !== "videos") return null;
  const videoId = youtubeIdFrom(story.videoUrl);
  const embedUrl = videoEmbedUrl(story.videoUrl);
  const name = cleanMetadataText(story.title);
  const description = cleanMetadataText(story.excerpt);
  const uploadDate = dateValue(story.publishedAt);
  if (!videoId || !embedUrl || !name || !description || !uploadDate) return null;
  return {
    "@context": "https://schema.org", "@type": "VideoObject",
    "@id": `${canonicalUrl}#video`, url: canonicalUrl,
    name, description, embedUrl,
    thumbnailUrl: [`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`],
    // Publication on alelm.net, matching the visible date; not a claimed YouTube upload date.
    uploadDate,
    associatedArticle: { "@id": `${canonicalUrl}#article` },
    // Do not infer the creator/rights holder of third-party embedded footage.
  };
}
