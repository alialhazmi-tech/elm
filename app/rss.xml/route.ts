import { listFeedEntries } from "@/lib/content/feed";
import { renderRss } from "@/lib/content/rss";
import { PUBLIC_CONTENT_CACHE_CONTROL } from "@/lib/content/cache-policy";

// Cache the public query with the existing publication invalidation tag, not the response.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return new Response(renderRss(await listFeedEntries()), {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": PUBLIC_CONTENT_CACHE_CONTROL,
      },
    });
  } catch {
    console.error("[rss] public_feed_read_failed");
    return new Response("Feed temporarily unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }
}
