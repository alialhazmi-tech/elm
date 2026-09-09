import { SECTIONS } from "./sections";
import { SERIES } from "./series";

export type TaxonomyKind = "section" | "series";
export type TaxonomyVisibility = Record<string, boolean>;
export const TAXONOMY_SECTIONS = [
  { slug: "news", name: "أخبار", shortName: "أخبار", description: "القسم العام للأخبار", seoDescription: "آخر أخبار منصة العلم", navPriority: 3 as const },
  ...SECTIONS.filter(item => item.slug !== "videos"),
];
export const TAXONOMY_SERIES = SERIES;
export const taxonomyKey = (kind: TaxonomyKind, slug: string) => `${kind}:${slug}`;
export const taxonomyHidden = (visibility: TaxonomyVisibility, kind: TaxonomyKind, slug: string) => visibility[taxonomyKey(kind, slug)] === true;

export function visibleTaxonomy(visibility: TaxonomyVisibility = {}) {
  return {
    sections: TAXONOMY_SECTIONS.filter(item => !taxonomyHidden(visibility, "section", item.slug)),
    series: TAXONOMY_SERIES.filter(item => !taxonomyHidden(visibility, "series", item.slug)),
  };
}
export type EditorialTaxonomy = ReturnType<typeof visibleTaxonomy>;

export function classificationInstructions(taxonomy: EditorialTaxonomy): string {
  return `اختر فقط من الأقسام والسلاسل المتاحة التالية؛ أي تصنيف آخر مخفي أو غير معتمد ولا يجوز اقتراحه. الأقسام: ${taxonomy.sections.map(item => `${item.slug} (${item.shortName || item.name})`).join("، ")}. السلاسل: ${taxonomy.series.map(item => `${item.slug} (${item.name})`).join("، ") || "لا توجد سلسلة متاحة"}. اختر seriesSlug=null إذا لم تناسب أي سلسلة.`;
}
