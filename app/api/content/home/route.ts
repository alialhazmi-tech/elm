import { contentSource, seedContentProvider } from "@/lib/content/provider";

export async function GET() {
  const home = await seedContentProvider.getHome();

  return Response.json(home, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      "X-Content-Contract": "home-bundle.v2",
      "X-Content-Source": await contentSource(),
    },
  });
}
