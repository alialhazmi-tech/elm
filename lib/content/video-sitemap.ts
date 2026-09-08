import { storyHref, type Story } from "./types.ts";
import { videoEmbedUrl, youtubeIdFrom } from "./video.ts";

export const escapeSitemapXml = (value: string) => value
  // XML 1.0 rejects these control characters even when entity-escaped.
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");

/** Same player as the article. YouTube provides a stable video-specific thumbnail. */
export function sitemapVideo(story: Story) {
  if (story.format !== "videos") return null;
  const id = youtubeIdFrom(story.videoUrl);
  const player = videoEmbedUrl(story.videoUrl);
  const title = story.title.trim();
  const description = story.excerpt.trim();
  // Social posts can be photos/private and need provider verification before inclusion.
  if (!id || !player || !title || !description) return null;
  return {
    url: new URL(storyHref(story), "https://alelm.net").href,
    player, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    title: title.slice(0, 100), description: description.slice(0, 2048),
  };
}

export function renderVideoSitemap(stories: Story[]): string {
  const entries = stories.flatMap((story) => {
    const video = sitemapVideo(story);
    if (!video) return [];
    return [`<url><loc>${escapeSitemapXml(video.url)}</loc><video:video>` +
      `<video:thumbnail_loc>${escapeSitemapXml(video.thumbnail)}</video:thumbnail_loc>` +
      `<video:title>${escapeSitemapXml(video.title)}</video:title>` +
      `<video:description>${escapeSitemapXml(video.description)}</video:description>` +
      `<video:player_loc>${escapeSitemapXml(video.player)}</video:player_loc>` +
      "</video:video></url>"];
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n' +
    entries.join("\n") + "\n</urlset>\n";
}
