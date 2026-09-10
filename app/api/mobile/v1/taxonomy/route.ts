import { listVisibleArchivedSeries } from "@/lib/content/provider";
import { loadPublicTaxonomy } from "@/lib/content/taxonomy-settings";
import { mobileHeaders } from "@/lib/mobile/catalog";
import { MOBILE_TAXONOMY_CONTRACT, toMobileTaxonomy } from "@/lib/mobile/taxonomy";

export async function GET() {
  const [taxonomy, archived] = await Promise.all([loadPublicTaxonomy(), listVisibleArchivedSeries().catch(() => [])]);
  return Response.json(toMobileTaxonomy(taxonomy, archived), { headers: await mobileHeaders(MOBILE_TAXONOMY_CONTRACT) });
}
