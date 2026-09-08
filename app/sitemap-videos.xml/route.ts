import { listVideoSitemapEntries } from "@/lib/content/provider";
import { renderVideoSitemap } from "@/lib/content/video-sitemap";
import { PUBLIC_CONTENT_CACHE_CONTROL } from "@/lib/content/cache-policy";

export const revalidate = 300;

export async function GET() {
  return new Response(renderVideoSitemap(await listVideoSitemapEntries()), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": PUBLIC_CONTENT_CACHE_CONTROL,
    },
  });
}
