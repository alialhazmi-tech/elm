import { PUBLIC_CONTENT_CACHE_CONTROL } from "@/lib/content/cache-policy";
import { contentSource, getBreaking, getNewsStrip, seedContentProvider, seriesDirectory } from "@/lib/content/provider";
import { MOBILE_HOME_CONTRACT, requestOrigin, toMobileHome } from "@/lib/mobile/home";
import { homeStream } from "@/lib/content/homeStream";
import { homePresentationExclusions, toMobileHomePresentation } from "@/lib/mobile/home-presentation";
import { loadPublicTaxonomy } from "@/lib/content/taxonomy-settings";

export async function GET(request: Request) {
  const [home, breaking, news, directory, taxonomy] = await Promise.all([
    seedContentProvider.getHome(), getBreaking(), getNewsStrip(5).catch(() => []),
    seriesDirectory().catch(() => ({} as Awaited<ReturnType<typeof seriesDirectory>>)),
    loadPublicTaxonomy(),
  ]);
  const stream = await homeStream(homePresentationExclusions(home)).catch(() => null);
  const origin = requestOrigin(request);
  const base = toMobileHome(home, breaking, origin);
  // كما في الرئيسية على الويب: السلاسل المخفية من التصنيف لا تظهر.
  const visible = new Set<string>(taxonomy.series.map((item) => item.slug));
  const payload = {
    ...base,
    series: visible.size > 0 ? base.series.filter((item) => visible.has(item.slug)) : base.series,
    presentation: toMobileHomePresentation(home, stream, directory, news, origin),
  };

  return Response.json(payload, {
    headers: {
      "Cache-Control": PUBLIC_CONTENT_CACHE_CONTROL,
      "X-Content-Contract": MOBILE_HOME_CONTRACT,
      "X-Content-Source": await contentSource(),
    },
  });
}
