import { PUBLIC_CONTENT_CACHE_CONTROL } from "@/lib/content/cache-policy";
import { contentSource, seedContentProvider } from "@/lib/content/provider";

export async function GET() {
  const home = await seedContentProvider.getHome();

  return Response.json(home, {
    headers: {
      "Cache-Control": PUBLIC_CONTENT_CACHE_CONTROL,
      "X-Content-Contract": "home-bundle.v2",
      "X-Content-Source": await contentSource(),
    },
  });
}
