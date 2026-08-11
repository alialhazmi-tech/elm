/**
 * مزود المحتوى الحالي: يقرأ من بذرة `seed.ts` المشتقة من مواد alelm.net المنشورة.
 * يُستبدل لاحقًا بمحوّل WordPress ثم بـ«تحرير العلم» دون تغيير العقد (M2-T1/M2-T2).
 *
 * الإثراءات هنا (الشائعة/الحقيقة، الأرقام) مشتقة من نصوص المواد الحقيقية نفسها —
 * وعند وصول خدمات الذكاء تتولد آليًا وتمر على اعتماد المحرر.
 */

import { asc, desc, eq } from "drizzle-orm";

import { stories as storiesTable } from "@/db/schema";
import { getDb } from "@/lib/db";
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

type Corpus = { articles: Story[]; videos: Story[]; stories: Story[]; source: "db" | "seed" };

const SEED_CORPUS: Corpus = {
  articles: seedArticles,
  videos: seedVideosList,
  stories: [...seedArticles, ...seedVideosList],
  source: "seed",
};

const DB_CACHE_MS = 60_000;
let corpusCache: { at: number; value: Corpus } | null = null;
let dbWarned = false;
const supportedSeriesSlugs = new Set<string>(ALL_SERIES.map((series) => series.slug));

function normalizeSeriesSlug(value: string | null): SeriesSlug | undefined {
  // المتقاعدة سلاسل مشروعة بأرشيف حي — لا إعادة تعيين (قرار المالك 2026-08-11).
  return value && supportedSeriesSlugs.has(value) ? (value as SeriesSlug) : undefined;
}

/** يقرأ المحتوى من Neon بكاش دقيقة؛ وعند غياب القاعدة أو فشلها يسقط للبذرة. */
async function loadCorpus(): Promise<Corpus> {
  const db = getDb();
  if (!db) return SEED_CORPUS;
  if (corpusCache && Date.now() - corpusCache.at < DB_CACHE_MS) return corpusCache.value;

  try {
    // الموقع العام يرى المنشور فقط — مسودات «تحرير العلم» لا تتسرب هنا.
    const rows = await db
      .select()
      .from(storiesTable)
      .where(eq(storiesTable.status, "published"))
      .orderBy(desc(storiesTable.publishedAt), asc(storiesTable.id));

    if (rows.length === 0) return SEED_CORPUS;

    const mapped: Story[] = rows.map((row) =>
      enrich({
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
        factCheck: (row.factCheck as Story["factCheck"]) ?? undefined,
        format: row.format ?? undefined,
        body: row.body || undefined,
        seoTitle: row.seoTitle || undefined,
        seoDescription: row.seoDescription || undefined,
        keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : undefined,
        pinned: row.pinned === 1,
        breakingUntil: row.breakingUntil ?? undefined,
      }),
    );

    const value: Corpus = {
      articles: mapped.filter((story) => story.section !== "videos"),
      videos: mapped.filter((story) => story.section === "videos"),
      stories: mapped,
      source: "db",
    };
    corpusCache = { at: Date.now(), value };
    return value;
  } catch (error) {
    if (!dbWarned) {
      dbWarned = true;
      console.error("[content] فشل القراءة من قاعدة البيانات — السقوط للبذرة:", error);
    }
    return SEED_CORPUS;
  }
}

export interface BreakingItem {
  title: string;
  href: string;
  until: string;
}

/** أحدث مادة «عاجل» سارية الصلاحية — يختفي الشريط وحده بانتهائها. */
export async function getBreaking(): Promise<BreakingItem | null> {
  const { stories } = await loadCorpus();
  const now = new Date().toISOString();
  const active = stories
    .filter((story) => story.breakingUntil && story.breakingUntil > now)
    .sort((a, b) => (b.breakingUntil ?? "").localeCompare(a.breakingUntil ?? ""));
  const story = active[0];
  return story ? { title: story.title, href: storyHref(story), until: story.breakingUntil! } : null;
}

/** شرائح «جاك العلم» لمادة منشورة — الظاهرة فقط وبترتيبها. */
export async function listPublicSlides(storyId: string) {
  const db = getDb();
  if (!db) return [];
  try {
    const { storySlides } = await import("@/db/schema");
    const { asc: ascOp } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(storySlides)
      .where(eq(storySlides.storyId, storyId))
      .orderBy(ascOp(storySlides.position));
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

/** مصدر المحتوى الفعلي للطلب الحالي — للتشخيص والترويسات. */
export async function contentSource(): Promise<"db" | "seed"> {
  return (await loadCorpus()).source;
}

export const sectionName = (slug: string) => SECTION_NAMES[slug] ?? slug;
export const seriesBySlug = new Map(ALL_SERIES.map((item) => [item.slug, item]));

export function seriesOf(story: Story): Series | undefined {
  return story.series ? seriesBySlug.get(story.series) : undefined;
}

export const KNOWN_SECTIONS = [
  ...new Set(SEED_CORPUS.stories.map((story) => story.section)),
];

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
      found.push({
        value: match[1],
        suffix: isPercent ? "%" : undefined,
        label: story.title,
        href: storyHref(story),
      });
      break;
    }
  }

  return found;
}

export const seedContentProvider: ContentProvider = {
  async getHome(): Promise<HomeData> {
    const { articles, videos, stories } = await loadCorpus();
    const seen = new Set<string>();

    // المثبت بقرار معتمد يتصدر؛ وإلا فالهيرو يتجنب الإنفوجرافيك (صوره نصية متزاحمة).
    const hero =
      articles.find((story) => story.pinned && story.image) ??
      articles.find((story) => story.section !== "infographics" && story.image) ??
      articles[0];
    seen.add(hero.id);

    const minis = takeUniqueStories(
      articles.filter((story) => story.section !== "infographics" && story.image),
      seen,
      2,
    );

    const dataStory =
      articles.find((story) => !seen.has(story.id) && /\d{2,4}\s*%/.test(story.title)) ?? null;
    if (dataStory) seen.add(dataStory.id);

    const mosaic = takeUniqueStories(
      articles.filter((story) => story.image && story.section !== "infographics"),
      seen,
      2,
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

    const brief: BriefItem[] = [hero, ...minis, dataStory]
      .filter((story): story is Story => story !== null)
      .slice(0, 3)
      .map((story) => {
        const storySeries = seriesOf(story);
        return {
          title: story.title,
          href: storyHref(story),
          color: storySeries?.color ?? "#3d7ef7",
          label: storySeries?.name ?? sectionName(story.section),
        };
      });

    // الأكثر قراءة: مواد حديثة غير مكررة مع ما عُرض أعلاه — بلا عدّادات إنتاجية بعد.
    const mostRead = stories
      .filter((story) => !seen.has(story.id) && story.section !== "videos")
      .sort(byDateDesc)
      .slice(0, 5);

    return {
      brief,
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
  },

  async getStory(id) {
    const { stories } = await loadCorpus();
    return stories.find((story) => story.id === id) ?? null;
  },

  async getSeries(slug) {
    return seriesBySlug.get(slug as SeriesSlug) ?? null;
  },

  async listSeries() {
    return SERIES;
  },

  async listBySeries(slug) {
    const { stories } = await loadCorpus();
    return stories.filter((story) => story.series === slug);
  },

  async listBySection(section) {
    const { stories } = await loadCorpus();
    return stories.filter((story) => story.section === section);
  },

  async listRelated(story, limit = 3) {
    const { stories } = await loadCorpus();
    const sameSeries = stories.filter(
      (item) => item.id !== story.id && item.series === story.series,
    );
    const sameSection = stories.filter(
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

  async listAll() {
    return (await loadCorpus()).stories;
  },

  async search(query) {
    const needle = normalizeArabic(query).toLowerCase();
    if (!needle) return [];

    const { stories } = await loadCorpus();
    return stories.filter((story) => {
      const haystack = normalizeArabic(`${story.title} ${story.excerpt}`).toLowerCase();
      return haystack.includes(needle);
    });
  },
};
