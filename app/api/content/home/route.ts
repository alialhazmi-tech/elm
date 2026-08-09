import { getHomeBundle } from "@/lib/content/home";
import { seedContentProvider } from "@/lib/content/provider";

export async function GET() {
  const bundle = await getHomeBundle(seedContentProvider);

  return Response.json(bundle, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      "X-Content-Contract": "home-bundle.v1",
    },
  });
}
