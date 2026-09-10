import { PUBLIC_CONTENT_CACHE_CONTROL } from "@/lib/content/cache-policy";
import { contentSource, getBreaking, getNewsStrip, seedContentProvider, seriesDirectory } from "@/lib/content/provider";
import { MOBILE_HOME_CONTRACT, requestOrigin, toMobileHome } from "@/lib/mobile/home";
import { homeStream } from "@/lib/content/homeStream";
import { homePresentationExclusions, toMobileHomePresentation } from "@/lib/mobile/home-presentation";

export async function GET(request: Request) {
  const [home, breaking, news, directory] = await Promise.all([
    seedContentProvider.getHome(), getBreaking(), getNewsStrip(5).catch(() => []),
    seriesDirectory().catch(() => ({} as Awaited<ReturnType<typeof seriesDirectory>>)),
  ]);
  const stream = await homeStream(homePresentationExclusions(home)).catch(() => null);
  const origin = requestOrigin(request);
  const payload = {
    ...toMobileHome(home, breaking, origin),
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
