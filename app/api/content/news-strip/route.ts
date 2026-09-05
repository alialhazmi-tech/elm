import { PUBLIC_CONTENT_CACHE_CONTROL } from "@/lib/content/cache-policy";
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
    { headers: { "Cache-Control": PUBLIC_CONTENT_CACHE_CONTROL } },
  );
}
