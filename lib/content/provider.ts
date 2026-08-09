/**
 * مزود المحتوى الحالي: يقرأ من بذرة `seed.ts` المشتقة من مواد alelm.net المنشورة.
 * يُستبدل لاحقًا بمحوّل WordPress ثم بـ«تحرير العلم» دون تغيير العقد (M2-T1/M2-T2).
 */

import { SECTION_NAMES, seedStories } from "./seed";
import type { ContentProvider, HomeBundle, Series, SeriesSlug, Story } from "./types";
import { normalizeArabic } from "@/lib/policy/normalize";

export const SERIES: Series[] = [
  { slug: "absat", name: "أبسط", description: "شرح متدرج للمفاهيم المعقدة", color: "#1f8f75" },
  { slug: "aghrab", name: "أغرب", description: "ما لا نتوقعه في العالم", color: "#d64b65" },
  { slug: "efhamha-sah", name: "افهمها صح", description: "فصل الحقيقة عن الشائعة", color: "#f2ae30" },
  { slug: "bel-arqam", name: "بالأرقام", description: "البيانات تحكي القصة", color: "#3f7dd7" },
  { slug: "shakhsiat", name: "شخصيات", description: "سِيَر صنعت أثرًا", color: "#725bb5" },
  { slug: "limatha", name: "لماذا", description: "تفكيك الأسباب خلف الظواهر", color: "#137c8b" },
  { slug: "matha-law", name: "ماذا لو", description: "سيناريوهات واحتمالات", color: "#b65c33" },
  { slug: "bel-tarikh", name: "بالتاريخ", description: "الزمن يضع الخبر في سياقه", color: "#8b6b43" },
  { slug: "matha-baad", name: "ماذا بعد", description: "قراءة التداعيات المقبلة", color: "#27718e" },
];

const byDateDesc = (a: Story, b: Story) =>
  (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

const stories = [...seedStories].sort(byDateDesc);

export const sectionName = (slug: string) => SECTION_NAMES[slug] ?? slug;

export const seriesBySlug = new Map(SERIES.map((item) => [item.slug, item]));

export function seriesOf(story: Story): Series | undefined {
  return story.series ? seriesBySlug.get(story.series) : undefined;
}

export const KNOWN_SECTIONS = [...new Set(stories.map((story) => story.section))];

function pick(predicate: (story: Story) => boolean, limit: number): Story[] {
  return stories.filter(predicate).slice(0, limit);
}

export const seedContentProvider: ContentProvider = {
  async getHomeCandidates() {
    // الهيرو يتجنب الإنفوجرافيك: صوره تحمل نصًا مطبوعًا فتتزاحم مع عنوان الصفحة.
    const hero = stories.find((story) => story.section !== "infographics") ?? stories[0];

    const sections: HomeBundle["sections"] = [
      {
        key: "behindNews",
        title: "وراء الخبر",
        kicker: "السياق قبل السرعة",
        stories: pick((story) => story.section !== "infographics", 12),
      },
      {
        key: "infographic",
        title: "بالأرقام",
        kicker: "البيانات تحكي القصة",
        stories: pick(
          (story) => story.section === "infographics" || story.series === "bel-arqam",
          12,
        ),
      },
      {
        key: "video",
        title: "شاهد الفكرة",
        kicker: "معرفة مرئية",
        stories: pick((story) => ["sport", "varieties", "sciences"].includes(story.section), 12),
      },
      {
        key: "podcast",
        title: "اسمع الحكاية",
        kicker: "صوت العلم",
        stories: pick((story) => ["economy", "politics", "culture"].includes(story.section), 12),
      },
    ];

    return { hero, sections, series: SERIES };
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
