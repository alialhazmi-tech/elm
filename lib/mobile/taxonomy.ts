/** تصنيفات الموقع للتطبيق — دالة نقية فوق مخرجات `loadPublicTaxonomy` و`listVisibleArchivedSeries`. */

export const MOBILE_TAXONOMY_CONTRACT = "mobile-taxonomy.v1";

export type MobileTaxonomySection = { slug: string; name: string; shortName: string; color: string | null };
export type MobileTaxonomySeries = { slug: string; name: string; description: string; color: string };

export type MobileTaxonomyPayload = {
  contract: typeof MOBILE_TAXONOMY_CONTRACT;
  sections: MobileTaxonomySection[];
  series: MobileTaxonomySeries[];
  archivedSeries: MobileTaxonomySeries[];
};

type SectionInput = { slug: string; name: string; shortName?: string; color?: string; navPriority?: number };
type SeriesInput = { slug: string; name: string; description: string; color: string };

const seriesChip = (item: SeriesInput): MobileTaxonomySeries => ({ slug: item.slug, name: item.name, description: item.description, color: item.color });

/** الأقسام مرتبة بأولوية التنقل ثم الاسم؛ السلاسل بترتيب الكتالوج. */
export function toMobileTaxonomy(
  taxonomy: { sections: SectionInput[]; series: SeriesInput[] },
  archivedSeries: SeriesInput[],
): MobileTaxonomyPayload {
  const sections = [...taxonomy.sections]
    .sort((a, b) => (a.navPriority ?? 3) - (b.navPriority ?? 3) || a.name.localeCompare(b.name, "ar"))
    .map((item) => ({ slug: item.slug, name: item.name, shortName: item.shortName || item.name, color: item.color ?? null }));
  return {
    contract: MOBILE_TAXONOMY_CONTRACT,
    sections,
    series: taxonomy.series.map(seriesChip),
    archivedSeries: archivedSeries.map(seriesChip),
  };
}
