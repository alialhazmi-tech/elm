/**
 * لوحات الرئيسية — أقسام بثلاثة إيقاعات ومعرض الإنفوجرافيك.
 * يقرأ من الكاش القائم (page:section / format) بلا جداول جديدة.
 *
 * «الجديد الآن» (النهر الحي) أُزيل بقرار المالك 2026-09-01 مع إعادة تصميم الرئيسية:
 * الأقسام نفسها تحمل أحدث ما نُشر، فلا يتكرر الخبر مرتين في صفحة واحدة.
 */

import { getSection } from "./sections";
import { listByFormat, pageBySection } from "./provider";
import type { Story } from "./types";

export const STREAM_SECTIONS = ["politics", "economy", "technology", "health", "sport", "world"] as const;
export type StreamSection = (typeof STREAM_SECTIONS)[number];

export interface SectionPanel {
  slug: StreamSection;
  name: string;
  color: string;
  /** المادة القائدة — الأولى بصورة إن وجدت. */
  lead: Story | null;
  /** بقية مواد اللوحة بعد القائدة. */
  rows: Story[];
  /** ما نُشر في القسم خلال آخر 24 ساعة. */
  todayCount: number;
}

export interface HomeStream {
  panels: Partial<Record<StreamSection, SectionPanel>>;
  infographics: Story[];
}

const DAY_MS = 86_400_000;
const isInfographic = (story: Story) => story.section === "infographics" || story.format === "infographics";
const isVideo = (story: Story) => story.section === "videos" || story.format === "videos";
const isPodcast = (story: Story) => story.format === "podcasts";

/** عدد المواد في كل لوحة بعد القائدة — يكفي إيقاعَي «القائمة» و«البطاقات الثلاث». */
export const PANEL_ROWS = 4;

/**
 * يركّب لوحات الأقسام الست مع ضمان ألا تتكرر مادة بين لوحتين ولا مع ما عُرض فوقها
 * (الصدارة والموجز). مواد الإنفوجرافيك والفيديو والبودكاست لها أقسامها الخاصة في الصفحة.
 */
export async function homeStream(exclude: Set<string>): Promise<HomeStream> {
  const [infographics, ...pages] = await Promise.all([
    listByFormat("infographics", 9).catch(() => [] as Story[]),
    ...STREAM_SECTIONS.map((slug) => pageBySection(slug, "1").catch(() => null)),
  ]);

  const since = Date.now() - DAY_MS;
  const shown = new Set<string>(exclude);
  const panels: HomeStream["panels"] = {};

  STREAM_SECTIONS.forEach((slug, index) => {
    const def = getSection(slug);
    const items = (pages[index]?.items ?? []).filter((s) => !isInfographic(s) && !isVideo(s) && !isPodcast(s));
    const unseen = items.filter((s) => !shown.has(s.id));
    const lead = unseen.find((s) => s.image) ?? unseen[0] ?? null;
    if (lead) shown.add(lead.id);
    const rows = unseen.filter((s) => s.id !== lead?.id).slice(0, PANEL_ROWS);
    for (const row of rows) shown.add(row.id);
    if (!lead && rows.length === 0) return;
    panels[slug] = {
      slug,
      name: def?.shortName ?? def?.name ?? slug,
      color: def?.color ?? "#1f4fa3",
      lead,
      rows,
      todayCount: items.filter((s) => s.publishedAt && Date.parse(s.publishedAt) >= since).length,
    };
  });

  return {
    panels,
    infographics: infographics.filter((s) => s.image && !shown.has(s.id)).slice(0, 9),
  };
}
