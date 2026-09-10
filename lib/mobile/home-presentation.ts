import type { HomeData, Story } from "@/lib/content/types";
import type { HomeStream } from "@/lib/content/homeStream";
import { homeBriefScript } from "@/lib/voice/home-brief";
import { toMobileCard } from "./home";

/** Same exclusions and editorial sections as app/page.tsx; additive to mobile-home.v1. */
export function homePresentationExclusions(home: HomeData): Set<string> {
  return new Set([home.hero?.id, ...home.mosaic.map(s => s.id), ...home.mostRead.map(s => s.id)]
    .filter((id): id is string => Boolean(id)));
}

export function toMobileHomePresentation(
  home: HomeData,
  stream: HomeStream | null,
  directory: Record<string, { count: number; latest: Story | null }>,
  newsStrip: Array<{ title: string; href: string; urgent: boolean }>,
  origin: string,
) {
  const card = (story: Story) => toMobileCard(story, origin);
  const shown = new Set([
    ...(stream?.river ?? []).map(s => s.id),
    ...(stream?.infographics ?? []).map(s => s.id),
    ...(stream?.panels ?? []).flatMap(p => [p.lead?.id, ...p.rows.map(s => s.id)]),
  ]);
  return {
    briefFrom: home.briefFrom,
    briefScript: homeBriefScript(home.brief),
    newsStrip,
    stream: stream ? {
      river: stream.river.map(card),
      pulse: stream.pulse,
      panels: stream.panels.map(panel => ({
        ...panel, lead: panel.lead ? card(panel.lead) : null, rows: panel.rows.map(card),
      })),
      infographics: stream.infographics.map(card),
    } : null,
    seriesDirectory: home.series.map(series => ({
      ...series,
      count: directory[series.slug]?.count ?? 0,
      latest: directory[series.slug]?.latest ? card(directory[series.slug].latest!) : null,
      archived: false,
    })),
    archive: home.mostRead.filter(s => !shown.has(s.id)).slice(0, 4).map(card),
  };
}
