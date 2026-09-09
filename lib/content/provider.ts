/**
 * مزود المحتوى: Neon أولًا باستعلامات موجهة مفهرسة — لا تحميل للأرشيف كله في الذاكرة.
 *
 * قبل الهجرة الكاملة كان المزود يقرأ كل المواد بمتونها في كاش دقيقة، وهذا ينهار عند
 * 29 ألف مادة. الآن كل حاجة استعلامها: نافذة حديثة خفيفة (بلا متن) للرئيسية والترشيح،
 * صفحات الأقسام والسلاسل ترقّم في SQL، والمادة الكاملة تُجلب بمعرّفها وتُكاش قصيرًا.
 *
 * القاعدة المتصلة الفارغة تُعرض فارغة. البذرة فقط إن غابت القاعدة أو فشل الاتصال —
 * لا تُملأ الواجهة بمحتوى تجريبي فوق قاعدة حيّة.
 */

import { and, asc, count, desc, eq, gt, isNotNull, ne, or, sql } from "drizzle-orm";

import { stories as storiesTable } from "@/db/schema";
import { getDb } from "@/lib/db";
import { LIST_PAGE_SIZE, paginate, parsePage, type PageSlice } from "./pagination";
import { SECTION_NAMES, seedStories, seedVideos } from "./seed";
import { takeUniqueStories } from "./dedupe";
import type {
  BriefItem,
  ContentProvider,
  FactCheck,
  HomeData,
  NumberStat,
  Series,
  SeriesSlug,
  Story,
} from "./types";
import { storyHref } from "./types";
import { normalizeArabic } from "@/lib/policy/normalize";
import { storyKeywords } from "./keywords";
import { cachedPublicQuery, invalidatePublicContent } from "./cache";

export { ALL_SERIES, ARCHIVED_SERIES, SERIES } from "./series";
import { ALL_SERIES, ARCHIVED_SERIES, SERIES } from "./series";

const byDateDesc = (a: Story, b: Story) =>
  (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

/** بلوكات الشائعة/الحقيقة لبعض مواد «افهمها صح» — تُستبدل بحقل تحريري في «تحرير العلم». */
const FACT_CHECKS: Array<{ match: string; factCheck: FactCheck }> = [
  {
    match: "جاذبية الأرض",
    factCheck: {
      rumor: "الاصطفاف الكوكبي في 12 أغسطس يوقف جاذبية الأرض 7 ثوانٍ ويجعل الأجسام تطفو.",
      truth:
        "لا يمكن لأي اصطفاف كوكبي التأثير على جاذبية الأرض؛ قوة جذب القمر نفسه — وهو الأقرب — أضعف من أن تُطفئ وزنك ولو للحظة.",
    },
  },
];

function enrich(story: Story): Story {
  const fact = FACT_CHECKS.find((entry) => story.title.includes(entry.match));
  if (fact && !story.factCheck) return { ...story, factCheck: fact.factCheck };
  return story;
}

const seedArticles = [...seedStories].sort(byDateDesc).map(enrich);
const seedVideosList = [...seedVideos].map(enrich);
const seedAll: Story[] = [...seedArticles, ...seedVideosList];

/* ============ كاش الاستعلامات الموجهة ============ */

const DB_CACHE_MS = 300_000;
const SITEMAP_TTL_MS = 30 * 60_000;
let dbHealthy = true;
let dbWarned = false;

type Db = NonNullable<ReturnType<typeof getDb>>;

/** قاعدة أولًا؛ وعند فشل الاستعلام (لا عند خلوّه) يسقط للبذرة كما في العقد القديم. */
async function dbOrSeed<T>(
  key: string,
  ttl: number,
  viaDb: (db: Db) => Promise<T>,
  viaSeed: () => T,
  fallbackOnError = true,
): Promise<T> {
  const db = getDb();
  if (!db) return viaSeed();
  try {
    const value = await cachedPublicQuery(key, ttl, () => viaDb(db));
    dbHealthy = true;
    return value;
  } catch (error) {
    if (!fallbackOnError) throw error;
    dbHealthy = false;
    if (!dbWarned) {
      dbWarned = true;
      console.error("[content] فشل القراءة من قاعدة البيانات — السقوط للبذرة:", error);
    }
    return viaSeed();
  }
}

/** يُستدعى من مسارات الكتابة بعد نجاح المعاملة، ويشمل كل قراءات الموقع العام. */
export function invalidateCorpus() {
  invalidatePublicContent();
}

/* ============ التحويل من صف القاعدة ============ */

const supportedSeriesSlugs = new Set<string>(ALL_SERIES.map((series) => series.slug));

function normalizeSeriesSlug(value: string | null): SeriesSlug | undefined {
  // المتقاعدة سلاسل مشروعة بأرشيف حي — لا إعادة تعيين (قرار المالك 2026-08-11).
  return value && supportedSeriesSlugs.has(value) ? (value as SeriesSlug) : undefined;
}

/** أعمدة البطاقة — كل شيء إلا المتن: القوائم والترشيح لا تحتاجه، والمتن أثقل الأعمدة. */
const CARD_COLUMNS = {
  id: storiesTable.id,
  slug: storiesTable.slug,
  section: storiesTable.section,
  title: storiesTable.title,
  excerpt: storiesTable.excerpt,
  eyebrow: storiesTable.eyebrow,
  readingMinutes: storiesTable.readingMinutes,
  seriesSlug: storiesTable.seriesSlug,
  image: storiesTable.image,
  publishedAt: storiesTable.publishedAt,
  factCheck: storiesTable.factCheck,
  format: storiesTable.format,
  seoTitle: storiesTable.seoTitle,
  seoDescription: storiesTable.seoDescription,
  keywords: storiesTable.keywords,
  pinned: storiesTable.pinned,
  breakingUntil: storiesTable.breakingUntil,
  videoUrl: storiesTable.videoUrl,
} as const;

type CardRow = {
  id: string;
  slug: string;
  section: string;
  title: string;
  excerpt: string;
  eyebrow: string;
  readingMinutes: number;
  seriesSlug: string | null;
  image: string | null;
  publishedAt: string | null;
  factCheck: unknown;
  format: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  keywords: unknown;
  pinned: number;
  breakingUntil: string | null;
  videoUrl: string | null;
  body?: string | null;
  updatedAt?: string | null;
};

function mapRow(row: CardRow): Story {
  return enrich({
    id: row.id,
    slug: row.slug,
    section: row.section,
    title: row.title,
    excerpt: row.excerpt,
    eyebrow: row.eyebrow,
    readingMinutes: row.readingMinutes,
    series: normalizeSeriesSlug(row.seriesSlug),
    image: row.image ?? undefined,
    publishedAt: row.publishedAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
    factCheck: (row.factCheck as Story["factCheck"]) ?? undefined,
    format: row.format ?? undefined,
    body: row.body || undefined,
    seoTitle: row.seoTitle || undefined,
    seoDescription: row.seoDescription || undefined,
    keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : undefined,
    pinned: row.pinned === 1,
    breakingUntil: row.breakingUntil ?? undefined,
    videoUrl: row.videoUrl || undefined,
  });
}

const PUBLISHED = eq(storiesTable.status, "published");
const RECENT_ORDER = [desc(storiesTable.publishedAt), asc(storiesTable.id)] as const;

/** نافذة الترشيح والرئيسية — أحدث المواد بلا متون. */
const RECENT_LIMIT = 400;

async function recentCardsFromDb(db: Db): Promise<Story[]> {
  const rows = await db
    .select(CARD_COLUMNS)
    .from(storiesTable)
    .where(PUBLISHED)
    .orderBy(...RECENT_ORDER)
    .limit(RECENT_LIMIT);
  return rows.map(mapRow);
}

/** أحدث المواد (بلا متون) — النافذة التي تعمل عليها الرئيسية والترشيح والبناء المسبق. */
export async function listRecent(limit = RECENT_LIMIT): Promise<Story[]> {
  const window = await dbOrSeed("recent", DB_CACHE_MS, recentCardsFromDb, () => seedAll);
  return window.slice(0, Math.min(limit, RECENT_LIMIT));
}

const isVideo = (story: Story) => story.section === "videos" || story.format === "videos";
const isInfographic = (story: Story) =>
  story.section === "infographics" || story.format === "infographics";

/* ============ العاجل ============ */

export interface BreakingItem {
  title: string;
  href: string;
  until: string;
  /** الساعة الأولى بعد النشر وحدها تستحق «عاجل». */
  urgent: boolean;
  /** اسم السلسلة، أو التصنيف إن لم تُنسَب المادة لسلسلة. */
  label: string;
}

const URGENT_MS = 3_600_000;

function toStripItem(story: Story, now: string, flagged: boolean): BreakingItem {
  return {
    title: story.title,
    href: storyHref(story),
    until: story.breakingUntil ?? story.publishedAt ?? now,
    urgent: Boolean(
      flagged && story.publishedAt && Date.parse(now) - Date.parse(story.publishedAt) < URGENT_MS,
    ),
    label: seriesOf(story)?.name ?? sectionName(story.section),
  };
}

/**
 * شريط الأخبار: العاجل الساري أولًا، وإلا أحدث مادة منشورة حتى لا يختفي الصف.
 * «عاجل» الأحمر يبقى للساعة الأولى من مادة مُعلَّمة فقط.
 */
export async function getBreaking(): Promise<BreakingItem | null> {
  const now = new Date().toISOString();
  const active = await dbOrSeed(
    "breaking",
    30_000,
    async (db) => {
      const rows = await db
        .select(CARD_COLUMNS)
        .from(storiesTable)
        .where(and(PUBLISHED, gt(storiesTable.breakingUntil, now)))
        .orderBy(desc(storiesTable.breakingUntil))
        .limit(1);
      return rows.map(mapRow);
    },
    () =>
      seedAll
        .filter((story) => story.breakingUntil && story.breakingUntil > now)
        .sort((a, b) => (b.breakingUntil ?? "").localeCompare(a.breakingUntil ?? ""))
        .slice(0, 1),
  );
  const flagged = active[0];
  if (flagged && flagged.breakingUntil && flagged.breakingUntil > now) {
    return toStripItem(flagged, now, true);
  }

  const latest = await dbOrSeed(
    "news-strip",
    30_000,
    async (db) => {
      const rows = await db
        .select(CARD_COLUMNS)
        .from(storiesTable)
        .where(PUBLISHED)
        .orderBy(...RECENT_ORDER)
        .limit(1);
      return rows.map(mapRow);
    },
    () => seedAll.slice(0, 1),
  );
  const story = latest[0];
  return story ? toStripItem(story, now, false) : null;
}

/**
 * مواد شريط الأخبار المتناوب: العاجل الساري أولًا ثم أحدث المواد المنشورة من دون تكرار.
 * تبقى getBreaking مفردة حفاظًا على عقد تطبيقات الجوال الحالي.
 */
export async function getNewsStrip(limit = 5): Promise<BreakingItem[]> {
  const safeLimit = Math.max(1, Math.min(limit, 8));
  const now = new Date().toISOString();
  const [lead, recent] = await Promise.all([getBreaking(), listRecent(safeLimit + 1)]);
  const items: BreakingItem[] = [];
  const seen = new Set<string>();

  if (lead) {
    items.push(lead);
    seen.add(lead.href);
  }

  for (const story of recent) {
    const item = toStripItem(story, now, false);
    if (seen.has(item.href)) continue;
    items.push(item);
    seen.add(item.href);
    if (items.length >= safeLimit) break;
  }

  return items.slice(0, safeLimit);
}

/* ============ شرائح جاك والسلاسل المتقاعدة ============ */

/** شرائح «جاك العلم» لمادة منشورة — الظاهرة فقط وبترتيبها. */
export async function listPublicSlides(storyId: string) {
  const db = getDb();
  if (!db) return [];
  try {
    const { storySlides } = await import("@/db/schema");
    const rows = await db
      .select()
      .from(storySlides)
      .where(eq(storySlides.storyId, storyId))
      .orderBy(asc(storySlides.position));
    return rows.filter((row) => row.hidden !== 1);
  } catch {
    return [];
  }
}

/** المتقاعدة الظاهرة في فهرس السلاسل — مفتاح الإظهار/الإخفاء من «تحرير العلم». */
export async function listVisibleArchivedSeries(): Promise<Series[]> {
  const db = getDb();
  if (!db) return ARCHIVED_SERIES;
  try {
    const { series: seriesTable } = await import("@/db/schema");
    const rows = await db.select().from(seriesTable);
    const hiddenSlugs = new Set(rows.filter((row) => row.hidden === 1).map((row) => row.slug));
    return ARCHIVED_SERIES.filter((series) => !hiddenSlugs.has(series.slug));
  } catch {
    return ARCHIVED_SERIES;
  }
}

/** مصدر المحتوى الفعلي — للتشخيص والترويسات. */
export async function contentSource(): Promise<"db" | "seed"> {
  if (!getDb()) return "seed";
  return dbHealthy ? "db" : "seed";
}

export const sectionName = (slug: string) => SECTION_NAMES[slug] ?? slug;
export const seriesBySlug = new Map(ALL_SERIES.map((item) => [item.slug, item]));

export function seriesOf(story: Story): Series | undefined {
  return story.series ? seriesBySlug.get(story.series) : undefined;
}

export const KNOWN_SECTIONS = [
  ...new Set([...Object.keys(SECTION_NAMES), ...seedAll.map((story) => story.section)]),
];

/* ============ ترقيم SQL لصفحات الأقسام والسلاسل ============ */

async function pageFromDb(
  db: Db,
  where: ReturnType<typeof and>,
  rawPage: string | undefined | null,
): Promise<PageSlice<Story>> {
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(storiesTable)
    .where(where);
  const pageCount = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE) || 1);
  const page = Math.min(parsePage(rawPage), pageCount);
  const offset = (page - 1) * LIST_PAGE_SIZE;
  const rows = await db
    .select(CARD_COLUMNS)
    .from(storiesTable)
    .where(where)
    .orderBy(...RECENT_ORDER)
    .limit(LIST_PAGE_SIZE)
    .offset(offset);
  const items = rows.map(mapRow);
  return {
    items,
    page,
    pageCount,
    total,
    from: total === 0 ? 0 : offset + 1,
    to: offset + items.length,
  };
}

/** صفحة قسم مرقّمة في SQL — الأرشيف الكامل دون تحميل القسم كله. */
export async function pageBySection(
  section: string,
  rawPage: string | undefined | null,
): Promise<PageSlice<Story>> {
  // «مرئي» أرشيف شكل لا قسم موضوعي: الفيديو يحتفظ بقسمه الأصلي وتجمعه الصفحة عبر format.
  const dbFilter = section === "videos"
    ? or(eq(storiesTable.section, section), eq(storiesTable.format, "videos"))
    : eq(storiesTable.section, section);
  const seedFilter = (story: Story) => section === "videos" ? isVideo(story) : story.section === section;
  return dbOrSeed(
    `page:section:${section}:${parsePage(rawPage)}`,
    DB_CACHE_MS,
    (db) => pageFromDb(db, and(PUBLISHED, dbFilter), rawPage),
    () => paginate(seedAll.filter(seedFilter).sort(byDateDesc), rawPage),
  );
}

/** صفحة سلسلة مرقّمة في SQL. */
export async function pageBySeries(
  slug: string,
  rawPage: string | undefined | null,
): Promise<PageSlice<Story>> {
  return dbOrSeed(
    `page:series:${slug}:${parsePage(rawPage)}`,
    DB_CACHE_MS,
    (db) => pageFromDb(db, and(PUBLISHED, eq(storiesTable.seriesSlug, slug)), rawPage),
    () => paginate(seedAll.filter((story) => story.series === slug).sort(byDateDesc), rawPage),
  );
}

export type SeriesDirectoryEntry = { count: number; latest: Story | null };

/** أرشيف الكلمة الصريحة، بترقيم SQL ودون إدخال نتائج بحث العنوان في الأرشيف. */
export async function pageByKeyword(
  value: string,
  rawPage: string | undefined | null,
): Promise<PageSlice<Story>> {
  const keyword = value.trim();
  if (!keyword) return paginate([], rawPage);
  const match = sql`exists (
    select 1 from jsonb_array_elements(
      case when jsonb_typeof(${storiesTable.keywords}) = 'array'
        then ${storiesTable.keywords} else '[]'::jsonb end
    ) as keyword_entry(value)
    where jsonb_typeof(keyword_entry.value) = 'string'
      and btrim(keyword_entry.value #>> '{}') = ${keyword}
  )`;
  return dbOrSeed(
    `page:keyword:${JSON.stringify([keyword, parsePage(rawPage)])}`,
    DB_CACHE_MS,
    (db) => pageFromDb(db, and(PUBLISHED, match), rawPage),
    () => paginate(seedAll.filter((story) => storyKeywords(story.keywords).includes(keyword)).sort(byDateDesc), rawPage),
  );
}

/** أعداد مواد السلاسل كلها وأحدث مادة للنشطة — لفهرس السلاسل بلا تحميل الأرشيف. */
export async function seriesDirectory(): Promise<Record<string, SeriesDirectoryEntry>> {
  return dbOrSeed(
    "series:directory",
    DB_CACHE_MS,
    async (db) => {
      const counts = await db
        .select({ slug: storiesTable.seriesSlug, total: count() })
        .from(storiesTable)
        .where(and(PUBLISHED, isNotNull(storiesTable.seriesSlug)))
        .groupBy(storiesTable.seriesSlug);
      const directory: Record<string, SeriesDirectoryEntry> = {};
      for (const series of ALL_SERIES) {
        directory[series.slug] = {
          count: counts.find((row) => row.slug === series.slug)?.total ?? 0,
          latest: null,
        };
      }
      // أحدث مادة للنشطة فقط (الفهرس يعرضها لها وحدها) — استعلام خفيف لكل سلسلة بكاش دقيقة.
      await Promise.all(
        SERIES.map(async (series) => {
          const rows = await db
            .select(CARD_COLUMNS)
            .from(storiesTable)
            .where(and(PUBLISHED, eq(storiesTable.seriesSlug, series.slug)))
            .orderBy(...RECENT_ORDER)
            .limit(1);
          directory[series.slug].latest = rows[0] ? mapRow(rows[0]) : null;
        }),
      );
      return directory;
    },
    () => {
      const directory: Record<string, SeriesDirectoryEntry> = {};
      for (const series of ALL_SERIES) {
        const stories = seedAll
          .filter((story) => story.series === series.slug)
          .sort(byDateDesc);
        directory[series.slug] = { count: stories.length, latest: stories[0] ?? null };
      }
      return directory;
    },
  );
}

/** مواد شكل معين (بودكاست/مرئي/تقارير) — لصفحات أرشيف الأشكال مثل /podcasts. */
export async function listByFormat(format: string, limit = 40): Promise<Story[]> {
  return dbOrSeed(
    `list:format:${format}:${limit}`,
    DB_CACHE_MS,
    async (db) => {
      const rows = await db
        .select(CARD_COLUMNS)
        .from(storiesTable)
        .where(and(PUBLISHED, eq(storiesTable.format, format)))
        .orderBy(...RECENT_ORDER)
        .limit(limit);
      return rows.map(mapRow);
    },
    () => seedAll.filter((story) => story.format === format).sort(byDateDesc).slice(0, limit),
  );
}

/* ============ البحث في SQL بتطبيع عربي ============ */

/** يجزئ الاستعلام إلى كلمات مطبّعة وينزع «الـ» وأخواتها من البداية لرفع الاستدعاء. */
export function searchTokens(query: string): string[] {
  return normalizeArabic(query)
    .toLowerCase()
    .replace(/[%_\\]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^(وال|فال|بال|كال|ال|لل)(?=.{2})/u, ""))
    .filter((token) => token.length > 1)
    .slice(0, 8);
}

const SEARCH_LIMIT = 200;

async function searchFromDb(db: Db, tokens: string[]): Promise<Story[]> {
  const haystack = storiesTable.searchText;
  const conditions = tokens.map((token) => sql`${haystack} like ${`%${token}%`}`);
  const rows = await db
    .select(CARD_COLUMNS)
    .from(storiesTable)
    .where(and(PUBLISHED, ...conditions))
    .orderBy(...RECENT_ORDER)
    .limit(SEARCH_LIMIT);
  return rows.map(mapRow);
}

function searchSeed(tokens: string[]): Story[] {
  return seedAll
    .filter((story) => {
      const haystack = normalizeArabic(
        `${story.title} ${story.excerpt} ${story.eyebrow} ${(story.keywords ?? []).join(" ")}`,
      ).toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    })
    .sort(byDateDesc)
    .slice(0, SEARCH_LIMIT);
}

/* ============ خريطة الموقع ============ */

export type SitemapStoryEntry = {
  id: string;
  slug: string;
  section: string;
  publishedAt: string | null;
  updatedAt: string | null;
};

/**
 * كل المواد المنشورة لخريطة الموقع — أعمدة الرابط والتواريخ فقط، بكاش نصف ساعة.
 * الأرشيف ~29 ألف رابط: خريطة واحدة صالحة (السقف 50 ألفًا)؛ عند الاقتراب منه تُقسَّم.
 */
export async function listSitemapEntries(): Promise<SitemapStoryEntry[]> {
  // كل شريحة دون حد Next Data Cache البالغ 2 MB؛ لا نكاش الأرشيف كله كقيمة واحدة.
  const pageSize = 1000;
  const entries: SitemapStoryEntry[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await dbOrSeed(
      `sitemap:stories:${offset}`,
      SITEMAP_TTL_MS,
      async (db) => {
        const rows = await db
          .select({
            id: storiesTable.id,
            slug: storiesTable.slug,
            section: storiesTable.section,
            publishedAt: storiesTable.publishedAt,
            updatedAt: storiesTable.updatedAt,
          })
          .from(storiesTable)
          .where(PUBLISHED)
          .orderBy(...RECENT_ORDER)
          .limit(pageSize)
          .offset(offset);
        return rows;
      },
      () =>
        seedAll.slice(offset, offset + pageSize).map((story) => ({
          id: story.id,
          slug: story.slug,
          section: story.section,
          publishedAt: story.publishedAt ?? null,
          updatedAt: null,
        })),
      false, // A failed archive query must not publish a truncated seed sitemap.
    );
    entries.push(...page);
    if (page.length < pageSize) return entries;
  }
}

/* ============ استخراج الأرقام للرئيسية ============ */

const STAT_PATTERNS: Array<{ pattern: RegExp; label: (story: Story) => string }> = [
  { pattern: /(\d{2,4})\s*%/u, label: (story) => story.title.replace(/[…]+$/, "") },
  { pattern: /(?:^|\s)(\d{1,3})\s+سعودي/u, label: (story) => story.title },
];

/** يستخرج أرقامًا بارزة من عناوين المواد ويربط كل رقم بمصدره. */
function extractNumbers(from: Story[]): NumberStat[] {
  const found: NumberStat[] = [];

  for (const story of from) {
    if (found.length === 3) break;
    const haystack = `${story.title} ${story.excerpt}`;

    for (const { pattern } of STAT_PATTERNS) {
      const match = pattern.exec(haystack);
      if (!match) continue;
      if (found.some((stat) => stat.href === storyHref(story))) break;

      const isPercent = match[0].includes("%");
      // الرقم الكبير فوق التسمية — «بنسبة 93%» داخلها تكرار يُحذف.
      const escaped = match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const label = isPercent
        ? story.title
            .replace(new RegExp(`\\s*بنسبة\\s*[%٪]?${escaped}\\s*[%٪]?`), "")
            .replace(/\s{2,}/g, " ")
            .trim()
        : story.title;
      found.push({
        value: match[1],
        suffix: isPercent ? "%" : undefined,
        label: label || story.title,
        href: storyHref(story),
      });
      break;
    }
  }

  return found;
}

/* ============ تركيب الرئيسية ============ */

function composeHome(articles: Story[], videos: Story[], stories: Story[]): HomeData {
  const seen = new Set<string>();

  // المثبت بقرار معتمد يتصدر؛ وإلا فالهيرو يتجنب الإنفوجرافيك (صوره نصية متزاحمة).
  const hero =
    articles.find((story) => story.pinned && story.image) ??
    articles.find((story) => !isInfographic(story) && story.image) ??
    articles[0] ??
    null;
  if (hero) seen.add(hero.id);

  const minis = takeUniqueStories(
    articles.filter((story) => !isInfographic(story) && story.image),
    seen,
    2,
  );

  const dataStory =
    articles.find((story) => !seen.has(story.id) && /\d{2,4}\s*%/.test(story.title)) ?? null;
  if (dataStory) seen.add(dataStory.id);

  const mosaic = takeUniqueStories(
    articles.filter((story) => story.image && !isInfographic(story)),
    seen,
    5,
  );

  const questionStory = articles.find(
    (story) => !seen.has(story.id) && story.series === "limatha",
  );
  const question = dataStory
    ? {
        kick: "لماذا",
        title: "لماذا يتنافس العالم على معدن لا يعرفه أغلب الناس؟",
        text: "التنجستن مثالًا: كيف يتحول عنصر مغمور إلى ورقة تفاوض بين الاقتصادات الكبرى.",
        href: storyHref(questionStory ?? dataStory),
      }
    : null;
  if (questionStory) seen.add(questionStory.id);

  const homeVideos = takeUniqueStories(videos, seen, 2);

  // الموجز يعرض ما ليس أمام القارئ: الهيرو مجاور له فلا يتكرر فيه.
  const briefExtras = takeUniqueStories(
    articles.filter((story) => !isInfographic(story)),
    seen,
    3,
  );
  const brief: BriefItem[] = [...minis, dataStory, ...briefExtras]
    .filter((story): story is Story => story !== null)
    .slice(0, 5)
    .map((story) => {
      const storySeries = seriesOf(story);
      return {
        title: story.title,
        href: storyHref(story),
        excerpt: story.excerpt,
        color: storySeries?.color ?? "#3d6fad",
        label: storySeries?.name ?? sectionName(story.section),
        publishedAt: story.publishedAt,
      };
    });

  // الأكثر قراءة: مواد حديثة غير مكررة مع ما عُرض أعلاه — بلا عدّادات إنتاجية بعد.
  const mostRead = stories
    .filter((story) => !seen.has(story.id) && !isVideo(story))
    .sort(byDateDesc)
    .slice(0, 5);

  return {
    brief,
    briefFrom: articles.filter((story) => !isInfographic(story)).length,
    hero,
    minis,
    dataStory,
    mosaic,
    question,
    videos: homeVideos,
    numbers: extractNumbers(stories),
    series: SERIES,
    mostRead,
  };
}

async function homeVideoCards(db: Db): Promise<Story[]> {
  const rows = await db
    .select(CARD_COLUMNS)
    .from(storiesTable)
    .where(
      and(
        PUBLISHED,
        or(eq(storiesTable.section, "videos"), eq(storiesTable.format, "videos")),
      ),
    )
    .orderBy(...RECENT_ORDER)
    .limit(8);
  return rows.map(mapRow);
}

async function pinnedCard(db: Db): Promise<Story | null> {
  const rows = await db
    .select(CARD_COLUMNS)
    .from(storiesTable)
    .where(and(PUBLISHED, eq(storiesTable.pinned, 1), isNotNull(storiesTable.image)))
    .orderBy(...RECENT_ORDER)
    .limit(1);
  return rows[0] ? mapRow(rows[0]) : null;
}

/* ============ المزود ============ */

export const seedContentProvider: ContentProvider = {
  async getHome(): Promise<HomeData> {
    const db = getDb();
    if (!db) {
      return composeHome(seedArticles, seedVideosList, seedAll);
    }
    try {
      const [recent, videos, pinned] = await Promise.all([
        cachedPublicQuery("recent", DB_CACHE_MS, () => recentCardsFromDb(db)),
        cachedPublicQuery("home:videos", DB_CACHE_MS, () => homeVideoCards(db)),
        cachedPublicQuery("home:pinned", DB_CACHE_MS, () => pinnedCard(db)),
      ]);
      dbHealthy = true;
      // المثبت قد يكون أقدم من النافذة الحديثة — يُقدَّم عليها دون تكرار.
      const articlesBase = recent.filter((story) => !isVideo(story));
      const articles =
        pinned && !articlesBase.some((story) => story.id === pinned.id)
          ? [pinned, ...articlesBase]
          : articlesBase;
      return composeHome(articles, videos, recent);
    } catch (error) {
      dbHealthy = false;
      if (!dbWarned) {
        dbWarned = true;
        console.error("[content] فشل القراءة من قاعدة البيانات — السقوط للبذرة:", error);
      }
      return composeHome(seedArticles, seedVideosList, seedAll);
    }
  },

  async getStory(id) {
    const clean = id.slice(0, 64);
    const story = await dbOrSeed(
      `story:${clean}`,
      DB_CACHE_MS,
      async (db) => {
        const rows = await db
          // القراءة العامة لا تحتاج أعمدة الملكية وإصدارات مسودات التحرير.
          .select({ ...CARD_COLUMNS, body: storiesTable.body, updatedAt: storiesTable.updatedAt })
          .from(storiesTable)
          .where(and(PUBLISHED, eq(storiesTable.id, clean)))
          .limit(1);
        return rows.map(mapRow);
      },
      () => seedAll.filter((item) => item.id === clean),
    );
    return story[0] ?? null;
  },

  async getSeries(slug) {
    return seriesBySlug.get(slug as SeriesSlug) ?? null;
  },

  async listSeries() {
    return SERIES;
  },

  async listBySeries(slug) {
    return dbOrSeed(
      `list:series:${slug}`,
      DB_CACHE_MS,
      async (db) => {
        const rows = await db
          .select(CARD_COLUMNS)
          .from(storiesTable)
          .where(and(PUBLISHED, eq(storiesTable.seriesSlug, slug)))
          .orderBy(...RECENT_ORDER)
          .limit(RECENT_LIMIT);
        return rows.map(mapRow);
      },
      () => seedAll.filter((story) => story.series === slug).sort(byDateDesc),
    );
  },

  async listBySection(section) {
    const dbFilter = section === "videos"
      ? or(eq(storiesTable.section, section), eq(storiesTable.format, "videos"))
      : eq(storiesTable.section, section);
    const seedFilter = (story: Story) => section === "videos" ? isVideo(story) : story.section === section;
    return dbOrSeed(
      `list:section:${section}`,
      DB_CACHE_MS,
      async (db) => {
        const rows = await db
          .select(CARD_COLUMNS)
          .from(storiesTable)
          .where(and(PUBLISHED, dbFilter))
          .orderBy(...RECENT_ORDER)
          .limit(RECENT_LIMIT);
        return rows.map(mapRow);
      },
      () => seedAll.filter(seedFilter).sort(byDateDesc),
    );
  },

  async listRelated(story, limit = 3) {
    return dbOrSeed(
      `related:${story.id}:${limit}`,
      DB_CACHE_MS,
      async (db) => {
        const notSelf = ne(storiesTable.id, story.id);
        const sameSeries = story.series
          ? await db
              .select(CARD_COLUMNS)
              .from(storiesTable)
              .where(and(PUBLISHED, notSelf, eq(storiesTable.seriesSlug, story.series)))
              .orderBy(...RECENT_ORDER)
              .limit(limit)
          : [];
        const sameSection = await db
          .select(CARD_COLUMNS)
          .from(storiesTable)
          .where(and(PUBLISHED, notSelf, eq(storiesTable.section, story.section)))
          .orderBy(...RECENT_ORDER)
          .limit(limit + sameSeries.length);
        const merged: Story[] = [];
        for (const candidate of [...sameSeries.map(mapRow), ...sameSection.map(mapRow)]) {
          if (candidate.id === story.id) continue;
          if (merged.some((item) => item.id === candidate.id)) continue;
          merged.push(candidate);
          if (merged.length === limit) break;
        }
        return merged;
      },
      () => {
        const sameSeries = seedAll.filter(
          (item) => item.id !== story.id && item.series === story.series,
        );
        const sameSection = seedAll.filter(
          (item) => item.id !== story.id && item.section === story.section,
        );
        const merged: Story[] = [];
        for (const candidate of [...sameSeries, ...sameSection]) {
          if (merged.some((item) => item.id === candidate.id)) continue;
          merged.push(candidate);
          if (merged.length === limit) break;
        }
        return merged;
      },
    );
  },

  /** نافذة حديثة لا الأرشيف كله — من يحتاج الأرشيف يستعلم القاعدة مباشرة (خريطة الموقع). */
  async listAll() {
    return listRecent(RECENT_LIMIT);
  },

  async search(query) {
    const tokens = searchTokens(query);
    if (tokens.length === 0) return [];
    return dbOrSeed(
      `search:${tokens.join("|")}`,
      DB_CACHE_MS,
      (db) => searchFromDb(db, tokens),
      () => searchSeed(tokens),
    );
  },
};

/** Published video cards only, in bounded cache entries; no article bodies. */
export async function listVideoSitemapEntries(): Promise<Story[]> {
  const entries: Story[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const page = await dbOrSeed(
      `sitemap:videos:${offset}`, SITEMAP_TTL_MS,
      async (db) => {
        const rows = await db.select(CARD_COLUMNS).from(storiesTable)
          .where(and(PUBLISHED, eq(storiesTable.format, "videos"), isNotNull(storiesTable.videoUrl)))
          .orderBy(...RECENT_ORDER).limit(pageSize).offset(offset);
        return rows.map(mapRow);
      },
      () => seedAll.filter((story) => story.format === "videos" && story.videoUrl).slice(offset, offset + pageSize),
      false,
    );
    entries.push(...page);
    if (page.length < pageSize) return entries;
  }
}
