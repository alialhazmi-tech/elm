import { PUBLIC_CONTENT_CACHE_CONTROL } from "@/lib/content/cache-policy";
import { listRecent } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";

/**
 * خريطة أخبار Google News — مواد آخر 48 ساعة فقط، بعقد news:news القياسي.
 * تُغذي فهرسة الأخبار السريعة وتبقى صغيرة مهما كبر الأرشيف.
 */

export const revalidate = 300;

const BASE_URL = "https://alelm.net";
const WINDOW_MS = 48 * 60 * 60 * 1000;

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export async function GET() {
  const since = Date.now() - WINDOW_MS;
  const recent = (await listRecent(200)).filter((story) => {
    const at = story.publishedAt ? Date.parse(story.publishedAt) : NaN;
    return Number.isFinite(at) && at >= since;
  });

  const entries = recent
    .map((story) => {
      const url = `${BASE_URL}${encodeURI(storyHref(story))}`;
      return [
        "  <url>",
        `    <loc>${escapeXml(url)}</loc>`,
        "    <news:news>",
        "      <news:publication>",
        "        <news:name>العلم</news:name>",
        "        <news:language>ar</news:language>",
        "      </news:publication>",
        `      <news:publication_date>${escapeXml(story.publishedAt ?? "")}</news:publication_date>`,
        `      <news:title>${escapeXml(story.title)}</news:title>`,
        "    </news:news>",
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    entries,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": PUBLIC_CONTENT_CACHE_CONTROL,
    },
  });
}
