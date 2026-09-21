import { MOBILE_PODCASTS_CONTRACT, mobileHeaders, toMobilePodcasts } from "@/lib/mobile/catalog";
import { requestOrigin } from "@/lib/mobile/home";

export async function GET(request: Request) {
  const payload = await toMobilePodcasts(requestOrigin(request));
  return Response.json(payload, { headers: await mobileHeaders(MOBILE_PODCASTS_CONTRACT) });
}
