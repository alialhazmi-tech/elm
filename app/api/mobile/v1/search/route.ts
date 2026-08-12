import { MOBILE_SEARCH_CONTRACT, mobileHeaders, toMobileSearch } from "@/lib/mobile/catalog";
import { requestOrigin } from "@/lib/mobile/home";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const payload = await toMobileSearch(query, requestOrigin(request));
  return Response.json(payload, { headers: await mobileHeaders(MOBILE_SEARCH_CONTRACT) });
}
