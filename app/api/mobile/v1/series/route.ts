import { MOBILE_SERIES_INDEX_CONTRACT, mobileHeaders, toMobileSeriesIndex } from "@/lib/mobile/catalog";

export async function GET() {
  const payload = await toMobileSeriesIndex();
  return Response.json(payload, { headers: await mobileHeaders(MOBILE_SERIES_INDEX_CONTRACT) });
}
