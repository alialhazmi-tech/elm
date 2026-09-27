/**
 * كتالوج البودكاست العام — البرامج والحلقات المستضافة من القاعدة (تديرها اللوحة).
 * كاش المحتوى العام نفسه (وسم public-content-v1) فيظهر النشر من اللوحة فورًا بعد الإبطال،
 * وبلا قاعدة أو عند فشلها تُقرأ البذرة المطابقة لترحيل 0020 كما يفعل مزود المحتوى.
 */

import { asc, eq } from "drizzle-orm";

import { podcastEpisodes, podcastShows } from "@/db/schema";
import { cachedPublicQuery } from "@/lib/content/cache";
import { listByFormat } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";
import { getDb } from "@/lib/db";
import {
  HOSTED_PODCAST_AUDIO,
  PODCAST_SHOWS,
  fetchEpisodes,
  podcastShowPath,
  type HostedPodcastAudio,
  type PodcastEpisode,
  type PodcastShow,
} from "@/lib/podcasts";

const TTL_MS = 300_000;
let warned = false;

type Db = NonNullable<ReturnType<typeof getDb>>;

async function dbOrSeed<T>(key: string, load: (db: Db) => Promise<T>, seed: () => T): Promise<T> {
  const db = getDb();
  if (!db) return seed();
  try {
    return await cachedPublicQuery(key, TTL_MS, () => load(db));
  } catch (error) {
    if (!warned) {
      warned = true;
      console.error("[podcasts] فشل القراءة من القاعدة — السقوط للبذرة:", error);
    }
    return seed();
  }
}

type ShowRow = typeof podcastShows.$inferSelect;
type EpisodeRow = typeof podcastEpisodes.$inferSelect;

export function showFromRow(row: ShowRow): PodcastShow {
  return {
    id: row.id,
    storyId: row.storyId,
    name: row.name,
    description: row.description,
    cover: row.cover ?? undefined,
    accent: row.accent,
    feedUrl: row.feedUrl,
    youtube: row.youtube,
  };
}

export function audioFromRow(row: EpisodeRow): HostedPodcastAudio {
  return {
    id: row.id,
    showId: row.showId,
    filename: row.filename,
    objectKey: row.objectKey,
    mime: row.mime,
    byteLength: row.byteLength,
    etag: row.etag,
    title: row.title,
    guest: row.guest,
    description: row.description,
    publishedAt: row.publishedAt,
    durationSeconds: row.durationSeconds,
    sourceUrl: row.sourceUrl,
    visible: row.visible === 1,
  };
}

/** البرامج الظاهرة بترتيبها. */
export function listPodcastShows(): Promise<PodcastShow[]> {
  return dbOrSeed(
    "podcasts:shows",
    async (db) => {
      const rows = await db.select().from(podcastShows).where(eq(podcastShows.visible, 1))
        .orderBy(asc(podcastShows.sortOrder), asc(podcastShows.createdAt));
      return rows.map(showFromRow);
    },
    () => PODCAST_SHOWS,
  );
}

/** الحلقات المستضافة الظاهرة كلها — الجدول صغير فيُقرأ مرة ويُرشَّح في الذاكرة. */
function listHostedAudio(): Promise<HostedPodcastAudio[]> {
  return dbOrSeed(
    "podcasts:hosted",
    async (db) => {
      const rows = await db.select().from(podcastEpisodes).where(eq(podcastEpisodes.visible, 1));
      return rows.map(audioFromRow);
    },
    () => HOSTED_PODCAST_AUDIO,
  );
}

export async function getPodcastShow(id: string): Promise<PodcastShow | undefined> {
  return (await listPodcastShows()).find((show) => show.id === id);
}

export async function podcastShowForStory(storyId: string): Promise<PodcastShow | undefined> {
  return (await listPodcastShows()).find((show) => show.storyId === storyId);
}

export async function hostedAudioFor(showId: string): Promise<HostedPodcastAudio[]> {
  return (await listHostedAudio()).filter((audio) => audio.showId === showId);
}

/** ملف حلقة ظاهرة لمسار /podcast-audio — لا يُقدَّم ما لا يعرفه الكتالوج. */
export async function findHostedAudio(filename: string): Promise<HostedPodcastAudio | null> {
  return (await listHostedAudio()).find((audio) => audio.filename === filename) ?? null;
}

/** حلقات برنامج: خلاصته مع حلقاته المرفوعة من اللوحة. */
export async function showEpisodes(show: PodcastShow): Promise<PodcastEpisode[]> {
  return fetchEpisodes(show, await hostedAudioFor(show.id));
}

export interface PodcastShowEntry {
  show: PodcastShow;
  /** الرابط المقدس لمادة البرنامج القديم، وإلا /podcasts/<id>. */
  href: string;
  description: string;
  cover: string | undefined;
  episodes: PodcastEpisode[];
}

/**
 * البرامج الظاهرة بحلقاتها وروابطها — لصفحة /podcasts وقسم الرئيسية.
 * مادة البرنامج القديم تعطيه رابطه وملخصه وصورته الاحتياطية.
 */
export async function podcastOverview(): Promise<PodcastShowEntry[]> {
  const [catalog, stories] = await Promise.all([listPodcastShows(), listByFormat("podcasts", 24)]);
  return Promise.all(
    catalog.map(async (show) => {
      const story = show.storyId ? stories.find((item) => item.id === show.storyId) : undefined;
      return {
        show,
        href: story ? storyHref(story) : podcastShowPath(show),
        description: show.description || story?.excerpt || "",
        cover: show.cover ?? story?.image ?? undefined,
        episodes: await showEpisodes(show).catch(() => []),
      };
    }),
  );
}

/** أحدث الحلقات عبر البرامج: حتى perShow من كل برنامج ثم الأحدث نشرًا. */
export function latestEpisodes(entries: PodcastShowEntry[], limit: number, perShow = 3) {
  return entries
    .flatMap(({ show, href, episodes }) => episodes.slice(0, perShow).map((episode) => ({ show, href, episode })))
    .sort((a, b) => (b.episode.publishedAt ?? "").localeCompare(a.episode.publishedAt ?? ""))
    .slice(0, limit);
}
