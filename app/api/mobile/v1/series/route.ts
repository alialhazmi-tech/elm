import { MOBILE_SERIES_INDEX_CONTRACT, mobileHeaders, toMobileSeriesIndex } from "@/lib/mobile/catalog";
import { requestOrigin } from "@/lib/mobile/home";

export async function GET(request: Request) {
  const payload = await toMobileSeriesIndex(requestOrigin(request));
  return Response.json(payload, { headers: await mobileHeaders(MOBILE_SERIES_INDEX_CONTRACT) });
}
