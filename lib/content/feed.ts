import { and, asc, desc, eq, isNull, lte, notInArray } from "drizzle-orm";
import { stories } from "@/db/schema";
import { getDb } from "@/lib/db";
import { cachedPublicQuery } from "./cache";
import { CANONICAL_STORY_ALIASES } from "./canonical-stories.ts";
import { RSS_LIMIT, type FeedEntry } from "./rss.ts";

/** A bounded, publication-ordered read. Never substitute demo content for a failed feed. */
export async function listFeedEntries(): Promise<FeedEntry[]> {
  const db = getDb();
  if (!db) throw new Error("Public feed database unavailable");
  return cachedPublicQuery("rss:published", 300_000, async () => {
    const rows = await db.select({
      id: stories.id,
      publicNumber: stories.publicNumber,
      section: stories.section,
      slug: stories.slug,
      title: stories.title,
      excerpt: stories.excerpt,
      publishedAt: stories.publishedAt,
    }).from(stories).where(and(
      eq(stories.status, "published"),
      isNull(stories.revisionOf),
      lte(stories.publishedAt, new Date().toISOString()),
      notInArray(stories.id, Object.keys(CANONICAL_STORY_ALIASES)),
    )).orderBy(desc(stories.publishedAt), asc(stories.id)).limit(RSS_LIMIT);
    return rows.map((row) => ({ ...row, publicNumber: row.publicNumber ?? undefined, publishedAt: row.publishedAt ?? undefined }));
  });
}
