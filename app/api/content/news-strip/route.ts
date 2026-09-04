import { getNewsStrip } from "@/lib/content/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = (await getNewsStrip(5)).map(({ title, href, urgent }) => ({
    title,
    href,
    urgent,
  }));

  return Response.json(
    { items },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}
