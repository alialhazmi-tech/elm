import { MOBILE_SERIES_FEED_CONTRACT, mobileHeaders, toMobileSeriesFeed } from "@/lib/mobile/catalog";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const payload = await toMobileSeriesFeed(slug);
  if (!payload) {
    return Response.json({ error: "السلسلة غير موجودة" }, { status: 404 });
  }
  return Response.json(payload, { headers: await mobileHeaders(MOBILE_SERIES_FEED_CONTRACT) });
}
