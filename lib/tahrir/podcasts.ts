/**
 * إدارة البودكاست في اللوحة: البرامج وحلقاتها المرفوعة. كل كتابة تُدوَّن في سجل التدقيق،
 * والمستدعي (Route Handler) يبطل كاش الموقع العام بعدها.
 */

import { asc, desc, eq, sql } from "drizzle-orm";

import { podcastEpisodes, podcastShows } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { EpisodeInput, ShowInput } from "@/lib/podcast-input";

import { audit } from "./service";

export class PodcastError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function requireDb() {
  const db = getDb();
  if (!db) throw new PodcastError("قاعدة البيانات غير مهيأة.", 503);
  return db;
}

const now = () => new Date().toISOString();

export type ShowRow = typeof podcastShows.$inferSelect;
export type EpisodeRow = typeof podcastEpisodes.$inferSelect;
export type ShowSummary = ShowRow & { hostedCount: number; hiddenCount: number; latestAt: string | null };

export async function listShowsAdmin(): Promise<ShowSummary[]> {
  const db = requireDb();
  const shows = await db.select().from(podcastShows).orderBy(asc(podcastShows.sortOrder), asc(podcastShows.createdAt));
  const counts = await db
    .select({
      showId: podcastEpisodes.showId,
      hostedCount: sql<number>`count(*)::int`,
      hiddenCount: sql<number>`count(*) filter (where ${podcastEpisodes.visible} = 0)::int`,
      latestAt: sql<string | null>`max(${podcastEpisodes.publishedAt})`,
    })
    .from(podcastEpisodes)
    .groupBy(podcastEpisodes.showId);
  const byShow = new Map(counts.map((row) => [row.showId, row]));
  return shows.map((show) => ({
    ...show,
    hostedCount: byShow.get(show.id)?.hostedCount ?? 0,
    hiddenCount: byShow.get(show.id)?.hiddenCount ?? 0,
    latestAt: byShow.get(show.id)?.latestAt ?? null,
  }));
}

export async function getShowAdmin(id: string): Promise<{ show: ShowRow; episodes: EpisodeRow[] } | null> {
  const db = requireDb();
  const [show] = await db.select().from(podcastShows).where(eq(podcastShows.id, id)).limit(1);
  if (!show) return null;
  const episodes = await db.select().from(podcastEpisodes).where(eq(podcastEpisodes.showId, id))
    .orderBy(desc(podcastEpisodes.publishedAt));
  return { show, episodes };
}

export async function createShow(input: ShowInput, actor: string): Promise<ShowRow> {
  const db = requireDb();
  const [existing] = await db.select({ id: podcastShows.id }).from(podcastShows).where(eq(podcastShows.id, input.id)).limit(1);
  if (existing) throw new PodcastError("هذا الرابط مستخدم لبرنامج آخر.", 409);
  const [{ next }] = await db.select({ next: sql<number>`coalesce(max(${podcastShows.sortOrder}), 0)::int + 1` }).from(podcastShows);
  const at = now();
  const [row] = await db.insert(podcastShows).values({
    id: input.id,
    name: input.name,
    description: input.description,
    cover: input.cover,
    accent: input.accent,
    feedUrl: input.feedUrl,
    youtube: input.youtube,
    storyId: null,
    visible: input.visible ? 1 : 0,
    sortOrder: next,
    createdAt: at,
    updatedAt: at,
  }).returning();
  await audit(actor, "podcast:show-create", undefined, `${input.name} (${input.id})`);
  return row;
}

export async function updateShow(id: string, input: ShowInput, actor: string): Promise<ShowRow> {
  const db = requireDb();
  const [row] = await db.update(podcastShows).set({
    name: input.name,
    description: input.description,
    cover: input.cover,
    accent: input.accent,
    feedUrl: input.feedUrl,
    youtube: input.youtube,
    visible: input.visible ? 1 : 0,
    updatedAt: now(),
  }).where(eq(podcastShows.id, id)).returning();
  if (!row) throw new PodcastError("البرنامج غير موجود.", 404);
  await audit(actor, "podcast:show-update", undefined, `${input.name} (${id})`);
  return row;
}

async function requireShow(id: string) {
  const db = requireDb();
  const [show] = await db.select().from(podcastShows).where(eq(podcastShows.id, id)).limit(1);
  if (!show) throw new PodcastError("البرنامج غير موجود.", 404);
  return show;
}

export interface StoredAudio {
  filename: string;
  objectKey: string;
  mime: string;
  byteLength: number;
  etag: string;
}

export async function createEpisode(input: EpisodeInput, audio: StoredAudio, actor: string): Promise<EpisodeRow> {
  const db = requireDb();
  const show = await requireShow(input.showId);
  const [taken] = await db.select({ id: podcastEpisodes.id }).from(podcastEpisodes)
    .where(eq(podcastEpisodes.filename, audio.filename)).limit(1);
  if (taken) throw new PodcastError("هذا الملف منشور في حلقة أخرى؛ ارفعه من جديد.", 409);
  const at = now();
  const [row] = await db.insert(podcastEpisodes).values({
    id: crypto.randomUUID(),
    showId: show.id,
    title: input.title,
    guest: input.guest,
    description: input.description,
    filename: audio.filename,
    objectKey: audio.objectKey,
    mime: audio.mime,
    byteLength: audio.byteLength,
    etag: audio.etag,
    durationSeconds: input.durationSeconds,
    publishedAt: input.publishedAt,
    visible: input.visible ? 1 : 0,
    sourceUrl: null,
    createdBy: actor,
    createdAt: at,
    updatedAt: at,
  }).returning();
  await audit(actor, "podcast:episode-publish", undefined, `${show.name}: ${input.title}`);
  return row;
}

export async function getEpisode(id: string): Promise<EpisodeRow | null> {
  const db = requireDb();
  const [row] = await db.select().from(podcastEpisodes).where(eq(podcastEpisodes.id, id)).limit(1);
  return row ?? null;
}

export async function updateEpisode(id: string, input: EpisodeInput, actor: string): Promise<EpisodeRow> {
  const db = requireDb();
  const show = await requireShow(input.showId);
  const [before] = await db.select({ visible: podcastEpisodes.visible }).from(podcastEpisodes).where(eq(podcastEpisodes.id, id)).limit(1);
  if (!before) throw new PodcastError("الحلقة غير موجودة.", 404);
  const [row] = await db.update(podcastEpisodes).set({
    showId: show.id,
    title: input.title,
    guest: input.guest,
    description: input.description,
    publishedAt: input.publishedAt,
    durationSeconds: input.durationSeconds,
    visible: input.visible ? 1 : 0,
    updatedAt: now(),
  }).where(eq(podcastEpisodes.id, id)).returning();
  const visibility = before.visible === row.visible ? "podcast:episode-update" : row.visible ? "podcast:episode-show" : "podcast:episode-hide";
  await audit(actor, visibility, undefined, `${show.name}: ${input.title}`);
  return row;
}
