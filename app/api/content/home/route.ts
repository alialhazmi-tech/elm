import { getHomeBundle } from "@/lib/content/home";
import { mockContentProvider } from "@/lib/content/mock-provider";

export async function GET() {
  const bundle = await getHomeBundle(mockContentProvider);

  return Response.json(bundle, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      "X-Content-Contract": "home-bundle.v1",
    },
  });
}
