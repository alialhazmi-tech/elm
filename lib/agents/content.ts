import { and, asc, desc, eq, isNull, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { stories } from "@/db/schema";
import { getDb } from "@/lib/db";
import { cachedPublicQuery } from "@/lib/content/cache";
import { CANONICAL_STORY_ALIASES, canonicalStoryHref } from "@/lib/content/canonical-stories";
import { composeHome, searchTokens } from "@/lib/content/provider";
import type { Story } from "@/lib/content/types";
import { AGENT_SITE } from "./discovery";

// Deliberate public projection: no owner, workflow, internal notes or member fields.
const cards = {
  id: stories.id, publicNumber: stories.publicNumber, section: stories.section, slug: stories.slug,
  title: stories.title, excerpt: stories.excerpt, image: stories.image,
  publishedAt: stories.publishedAt, updatedAt: stories.updatedAt, format: stories.format,
  eyebrow: stories.eyebrow, readingMinutes: stories.readingMinutes, pinned: stories.pinned,
};
const articleColumns = { ...cards, body: stories.body, videoUrl: stories.videoUrl, factCheck: stories.factCheck };
type Row = Pick<typeof stories.$inferSelect, keyof typeof cards>;

function database() {
  const db = getDb();
  if (!db) throw new Error("Public content database unavailable");
  return db;
}

function published() {
  return and(
    eq(stories.status, "published"), isNull(stories.revisionOf),
    lte(stories.publishedAt, new Date().toISOString()),
    notInArray(stories.id, Object.keys(CANONICAL_STORY_ALIASES)),
    // Interactive reports remain outside this read-only rollout.
    or(isNull(stories.format), ne(stories.format, "jakalelm")),
  );
}

export function publicCard(row: Row) {
  return {
    id: row.publicNumber ? String(row.publicNumber) : row.id,
    title: row.title, description: row.excerpt,
    url: new URL(canonicalStoryHref(row), AGENT_SITE).href,
    section: row.section, image: row.image ? new URL(row.image, AGENT_SITE).href : null,
    publishedAt: row.publishedAt, updatedAt: row.updatedAt,
  };
}

export async function readArticle(id: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/u.test(id)) return null;
  const canonicalId = CANONICAL_STORY_ALIASES[id]?.id ?? id;
  const db = database();
  return cachedPublicQuery(`agents:article:${canonicalId}`, 300_000, async () => {
    const number = /^[1-9][0-9]{0,8}$/u.test(canonicalId) ? Number(canonicalId) : null;
    const [row] = await db.select(articleColumns).from(stories).where(and(published(), number === null
      ? eq(stories.id, canonicalId)
      : or(eq(stories.id, canonicalId), eq(stories.publicNumber, number))))
      .orderBy(desc(sql`${stories.id} = ${canonicalId}`)).limit(1);
    return row ?? null;
  });
}

export async function searchArticles(query: string, page: number) {
  const tokens = searchTokens(query);
  if (!tokens.length) return { items: [], page, pageCount: 0, total: 0, capped: false };
  const db = database();
  // Match the existing public search cap, and never cache arbitrary queries indefinitely.
  const rows = await db.select(cards).from(stories).where(and(published(),
    ...tokens.map((token) => sql`${stories.searchText} like ${`%${token}%`}`),
  )).orderBy(desc(stories.publishedAt), asc(stories.id)).limit(201);
  const bounded = rows.slice(0, 200);
  return { items: bounded.slice((page - 1) * 20, page * 20).map(publicCard),
    page, pageCount: Math.ceil(bounded.length / 20), total: bounded.length, capped: rows.length > 200 };
}

/** Reuse the homepage's editorial composition, with fail-closed publication filtering. */
export async function readHome() {
  const db = database();
  return cachedPublicQuery("agents:home", 120_000, async () => {
    const [recent, pinned] = await Promise.all([
      db.select(cards).from(stories).where(published())
        .orderBy(desc(sql`coalesce(${stories.boostedAt}, ${stories.publishedAt})`), asc(stories.id)).limit(400),
      db.select(cards).from(stories).where(and(published(), eq(stories.pinned, 1)))
        .orderBy(desc(stories.publishedAt), asc(stories.id)).limit(1),
    ]);
    const asStory = (row: Row): Story => ({ ...row, publicNumber: row.publicNumber ?? undefined,
      image: row.image ?? undefined, publishedAt: row.publishedAt ?? undefined,
      updatedAt: row.updatedAt ?? undefined, format: row.format ?? undefined, pinned: row.pinned === 1 });
    const list = recent.map(asStory);
    const articles = list.filter((story) => story.section !== "videos" && story.format !== "videos");
    if (pinned[0] && !articles.some((story) => story.id === pinned[0].id)) articles.unshift(asStory(pinned[0]));
    return composeHome(articles, list.filter((story) => story.section === "videos" || story.format === "videos"), list);
  });
}
