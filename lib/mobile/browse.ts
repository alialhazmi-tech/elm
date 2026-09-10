import { KNOWN_SECTIONS, pageBySection, pageBySeries, seedContentProvider } from "@/lib/content/provider";
import { toMobileCard } from "@/lib/mobile/home";

export const MOBILE_BROWSE_CONTRACT = "mobile-browse.v1";

/** Same published archive and SQL pagination as the website, without article bodies. */
export async function mobileBrowse(kind: string, slug: string, page: string | null, origin: string) {
  if (kind !== "section" && kind !== "series") return null;
  if (kind === "section" && !KNOWN_SECTIONS.includes(slug)) return null;
  if (kind === "series" && !(await seedContentProvider.getSeries(slug))) return null;
  const result = kind === "section" ? await pageBySection(slug, page) : await pageBySeries(slug, page);
  return {
    contract: MOBILE_BROWSE_CONTRACT,
    kind, slug,
    stories: result.items.map(story => toMobileCard(story, origin)),
    total: result.total,
    page: result.page,
    nextPage: result.page < result.pageCount ? result.page + 1 : null,
  };
}
