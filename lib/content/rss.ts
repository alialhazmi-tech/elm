import { canonicalStoryHref, isCanonicalStoryAliasId } from "./canonical-stories.ts";
import { escapeSitemapXml as xml } from "./video-sitemap.ts";
import { cleanMetadataText } from "../seo/metadata.ts";
import type { Story } from "./types.ts";

export const RSS_LIMIT = 50;
export type FeedEntry = Pick<Story, "id" | "publicNumber" | "section" | "slug" | "title" | "excerpt" | "publishedAt">;

/** Public summaries only. Sorting never treats an editorial boost as a new publication. */
export function renderRss(entries: FeedEntry[], now = Date.now()): string {
  const seen = new Set<string>();
  const items = entries
    .filter((entry) => {
      const published = Date.parse(entry.publishedAt ?? "");
      return !isCanonicalStoryAliasId(entry.id) && Number.isFinite(published) && published <= now && cleanMetadataText(entry.title);
    })
    .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!) || a.id.localeCompare(b.id))
    .flatMap((entry) => {
      const url = new URL(canonicalStoryHref(entry), "https://alelm.net").href;
      if (seen.has(url)) return [];
      seen.add(url);
      // RSS descriptions contain encoded HTML. Escape both the HTML text and XML layer.
      const summary = cleanMetadataText(entry.excerpt);
      return [
        "<item>",
        `<title>${xml(cleanMetadataText(entry.title))}</title>`,
        `<link>${xml(url)}</link>`,
        `<guid isPermaLink="true">${xml(url)}</guid>`,
        `<pubDate>${new Date(entry.publishedAt!).toUTCString()}</pubDate>`,
        ...(summary ? [`<description>${xml(xml(summary))}</description>`] : []),
        "</item>",
      ].join("\n");
    }).slice(0, RSS_LIMIT);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    "<title>العلم — أحدث المواد</title>",
    "<link>https://alelm.net/</link>",
    "<description>ملخصات أحدث المواد المنشورة في العلم وروابطها الأصلية.</description>",
    "<language>ar-SA</language>",
    '<atom:link href="https://alelm.net/rss.xml" rel="self" type="application/rss+xml" />',
    "<ttl>5</ttl>",
    ...items,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
}
