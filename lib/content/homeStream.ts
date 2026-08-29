/**
 * تدفّق الرئيسية — «الجديد الآن» ولوحات الأقسام ومعرض الإنفوجرافيك.
 * يقرأ من الكاش القائم (recent / page:section / format) بلا جداول جديدة.
 */

import { getSection } from "./sections";
import { listByFormat, listRecent, pageBySection } from "./provider";
import type { Story } from "./types";

export const STREAM_SECTIONS = ["politics", "economy", "sport", "health", "technology", "world"] as const;

export interface SectionPanel {
  slug: string;
  name: string;
  color: string;
  lead: Story | null;
  rows: Story[];
  /** ما نُشر في القسم خلال آخر 24 ساعة. */
  todayCount: number;
}

export interface HomeStream {
  river: Story[];
  pulse: { todayCount: number; lastAt: string | null; hours: number[]; nowMs: number; nowHour: number };
  panels: SectionPanel[];
  infographics: Story[];
}

const DAY_MS = 86_400_000;
const isInfographic = (story: Story) => story.section === "infographics" || story.format === "infographics";
const isVideo = (story: Story) => story.section === "videos" || story.format === "videos";
const isJak = (story: Story) => story.format === "jakalelm";

function riyadhHour(iso: string): number {
  const date = new Date(iso);
  return (date.getUTCHours() + 3) % 24;
}

/** النهر: آخر المواد الإخبارية (بلا إنفوجرافيك/فيديو/جاك) مع استبعاد ما عُرض في الصدارة. */
export async function homeRiver(exclude: Set<string>, limit = 10): Promise<Story[]> {
  const recent = await listRecent(80);
  return recent.filter((story) => !exclude.has(story.id) && !isInfographic(story) && !isVideo(story) && !isJak(story)).slice(0, limit);
}

export async function homeStream(exclude: Set<string>): Promise<HomeStream> {
  const [recent, infographics, ...pages] = await Promise.all([
    listRecent(80),
    listByFormat("infographics", 9).catch(() => [] as Story[]),
    ...STREAM_SECTIONS.map((slug) => pageBySection(slug, "1").catch(() => null)),
  ]);

  const river = recent.filter((s) => !exclude.has(s.id) && !isInfographic(s) && !isVideo(s) && !isJak(s)).slice(0, 10);
  const since = Date.now() - DAY_MS;
  const today = recent.filter((s) => s.publishedAt && Date.parse(s.publishedAt) >= since);
  const hours = Array.from({ length: 24 }, () => 0);
  for (const story of today) if (story.publishedAt) hours[riyadhHour(story.publishedAt)] += 1;

  const shown = new Set<string>([...exclude, ...river.map((s) => s.id)]);
  const panels: SectionPanel[] = STREAM_SECTIONS.map((slug, index) => {
    const def = getSection(slug);
    const items = (pages[index]?.items ?? []).filter((s) => !isInfographic(s) && !isVideo(s));
    const unseen = items.filter((s) => !shown.has(s.id));
    const lead = unseen.find((s) => s.image) ?? unseen[0] ?? null;
    if (lead) shown.add(lead.id);
    const rows = items.filter((s) => s.id !== lead?.id && !shown.has(s.id)).slice(0, 3);
    for (const row of rows) shown.add(row.id);
    return {
      slug,
      name: def?.shortName ?? def?.name ?? slug,
      color: def?.color ?? "#1f4fa3",
      lead,
      rows,
      todayCount: items.filter((s) => s.publishedAt && Date.parse(s.publishedAt) >= since).length,
    };
  }).filter((panel) => panel.lead || panel.rows.length);

  return {
    river,
    pulse: { todayCount: today.length, lastAt: recent[0]?.publishedAt ?? null, hours, nowMs: Date.now(), nowHour: (new Date().getUTCHours() + 3) % 24 },
    panels,
    infographics: infographics.filter((s) => s.image).slice(0, 9),
  };
}
