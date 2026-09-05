import { PUBLIC_CONTENT_CACHE_CONTROL } from "@/lib/content/cache-policy";
import { contentSource, getBreaking, seedContentProvider } from "@/lib/content/provider";
import { MOBILE_HOME_CONTRACT, requestOrigin, toMobileHome } from "@/lib/mobile/home";

export async function GET(request: Request) {
  const [home, breaking] = await Promise.all([seedContentProvider.getHome(), getBreaking()]);
  const payload = toMobileHome(home, breaking, requestOrigin(request));

  return Response.json(payload, {
    headers: {
      "Cache-Control": PUBLIC_CONTENT_CACHE_CONTROL,
      "X-Content-Contract": MOBILE_HOME_CONTRACT,
      "X-Content-Source": await contentSource(),
    },
  });
}
