/**
 * مزود المحتوى الحالي: يقرأ من بذرة `seed.ts` المشتقة من مواد alelm.net المنشورة.
 * يُستبدل لاحقًا بمحوّل WordPress ثم بـ«تحرير العلم» دون تغيير العقد (M2-T1/M2-T2).
 *
 * الإثراءات هنا (خلاصة القراءة، الشائعة/الحقيقة، الأرقام) مشتقة من نصوص المواد
 * الحقيقية نفسها — وعند وصول خدمات الذكاء تتولد آليًا وتمر على اعتماد المحرر.
 */

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

/** طيف السلاسل — القيم مطابقة لرموز CSS في globals.css. */
export const SERIES: Series[] = [
  { slug: "absat", name: "أبسط", description: "شرح متدرج للمعقد", color: "#12b5a0" },
  { slug: "aghrab", name: "أغرب", description: "ما لا تتوقعه", color: "#ef476f" },
  { slug: "efhamha-sah", name: "افهمها صح", description: "الحقيقة ضد الشائعة", color: "#eda313" },
  { slug: "bel-arqam", name: "بالأرقام", description: "البيانات تحكي", color: "#3d7ef7" },
  { slug: "shakhsiat", name: "شخصيات", description: "سِيَر صنعت أثرًا", color: "#8b5cf6" },
  { slug: "limatha", name: "لماذا", description: "الأسباب خلف الظواهر", color: "#14a8d6" },
  { slug: "matha-law", name: "ماذا لو", description: "سيناريوهات واحتمالات", color: "#f26a1b" },
  { slug: "bel-tarikh", name: "بالتاريخ", description: "الزمن يعطي السياق", color: "#c08a2e" },
  { slug: "matha-baad", name: "ماذا بعد", description: "قراءة التداعيات", color: "#2eb873" },
];

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

const articles = [...seedStories].sort(byDateDesc).map(enrich);
const videos = [...seedVideos].map(enrich);
const stories = [...articles, ...videos];

export const sectionName = (slug: string) => SECTION_NAMES[slug] ?? slug;
export const seriesBySlug = new Map(SERIES.map((item) => [item.slug, item]));

export function seriesOf(story: Story): Series | undefined {
  return story.series ? seriesBySlug.get(story.series) : undefined;
}

export const KNOWN_SECTIONS = [...new Set(stories.map((story) => story.section))];

/** يقسم المقتطف إلى نقاط خلاصة قصيرة — بديل مؤقت لخدمة التلخيص المعتمدة. */
function quickTakeFrom(excerpt: string): string[] | undefined {
  const parts = excerpt
    .split(/(?<=[.؟!])\s+/)
    .map((part) => part.replace(/[…]+$/, "").trim())
    .filter((part) => part.length > 24);
  return parts.length >= 2 ? parts.slice(0, 3) : undefined;
}

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
    const seen = new Set<string>();

    // الهيرو يتجنب الإنفوجرافيك: صوره تحمل نصًا مطبوعًا يتزاحم مع العنوان.
    const hero =
      articles.find((story) => story.section !== "infographics" && story.image) ?? articles[0];
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

    const heroWithTake: Story = {
      ...hero,
      quickTake: hero.quickTake ?? quickTakeFrom(hero.excerpt),
    };

    const briefPalette = ["#2eb873", "#3d7ef7", "#eda313"];
    const brief: BriefItem[] = [heroWithTake, ...minis, dataStory]
      .filter((story): story is Story => story !== null)
      .slice(0, 3)
      .map((story, index) => ({
        title: story.title,
        href: storyHref(story),
        color: briefPalette[index % briefPalette.length],
      }));

    return {
      brief,
      hero: heroWithTake,
      minis,
      dataStory,
      mosaic,
      question,
      videos: homeVideos,
      numbers: extractNumbers(stories),
      series: SERIES,
    };
  },

  async getStory(id) {
    return stories.find((story) => story.id === id) ?? null;
  },

  async getSeries(slug) {
    return seriesBySlug.get(slug as SeriesSlug) ?? null;
  },

  async listSeries() {
    return SERIES;
  },

  async listBySeries(slug) {
    return stories.filter((story) => story.series === slug);
  },

  async listBySection(section) {
    return stories.filter((story) => story.section === section);
  },

  async listRelated(story, limit = 3) {
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
    return stories;
  },

  async search(query) {
    const needle = normalizeArabic(query).toLowerCase();
    if (!needle) return [];

    return stories.filter((story) => {
      const haystack = normalizeArabic(`${story.title} ${story.excerpt}`).toLowerCase();
      return haystack.includes(needle);
    });
  },
};
