import { MOBILE_SERIES_FEED_CONTRACT, mobileHeaders, toMobileSeriesFeed } from "@/lib/mobile/catalog";
import { requestOrigin } from "@/lib/mobile/home";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const payload = await toMobileSeriesFeed(slug, requestOrigin(request));
  if (!payload) {
    return Response.json({ error: "السلسلة غير موجودة" }, { status: 404 });
  }
  return Response.json(payload, { headers: await mobileHeaders(MOBILE_SERIES_FEED_CONTRACT) });
}
