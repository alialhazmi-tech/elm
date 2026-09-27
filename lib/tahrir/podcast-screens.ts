/** بيانات شاشات البودكاست في اللوحة: البرامج بعدّاداتها وروابطها العامة، وحلقات الخلاصة للعرض. */

import type { AdminEpisode, AdminShow, FeedEpisode } from "@/components/tahrir/podcasts/types";
import { seedContentProvider } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";
import { fetchRssEpisodes, podcastShowPath, presentEpisode, type PodcastEpisode } from "@/lib/podcasts";

import type { EpisodeRow, ShowRow, ShowSummary } from "./podcasts";

async function publicPath(show: ShowRow): Promise<string> {
  if (!show.storyId) return podcastShowPath(show);
  const story = await seedContentProvider.getStory(show.storyId).catch(() => null);
  return story ? storyHref(story) : podcastShowPath(show);
}

export async function toAdminShow(show: ShowSummary, feed: PodcastEpisode[]): Promise<AdminShow> {
  return {
    id: show.id,
    name: show.name,
    description: show.description,
    cover: show.cover,
    accent: show.accent,
    feedUrl: show.feedUrl,
    youtube: show.youtube,
    storyId: show.storyId,
    visible: show.visible === 1,
    hostedCount: show.hostedCount,
    hiddenCount: show.hiddenCount,
    rssCount: feed.length,
    latestAt: show.latestAt,
    publicPath: await publicPath(show),
  };
}

export function toAdminEpisode(row: EpisodeRow): AdminEpisode {
  return {
    id: row.id,
    showId: row.showId,
    title: row.title,
    guest: row.guest,
    description: row.description,
    filename: row.filename,
    mime: row.mime,
    byteLength: row.byteLength,
    durationSeconds: row.durationSeconds,
    publishedAt: row.publishedAt,
    visible: row.visible === 1,
  };
}

export function toFeedEpisode(episode: PodcastEpisode, showName: string): FeedEpisode {
  const presented = presentEpisode(episode.title, showName, episode.description);
  return { title: presented.title, guest: presented.guest, duration: episode.duration, publishedAt: episode.publishedAt, audioUrl: episode.audioUrl };
}

export { fetchRssEpisodes };
