import { MOBILE_JAK_CONTRACT, mobileHeaders, toMobileJak } from "@/lib/mobile/catalog";
import { requestOrigin } from "@/lib/mobile/home";

export async function GET(request: Request) {
  const payload = await toMobileJak(new URL(request.url).searchParams.get("limit"), requestOrigin(request));
  return Response.json(payload, { headers: await mobileHeaders(MOBILE_JAK_CONTRACT) });
}
