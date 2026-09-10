import { MOBILE_SEARCH_CONTRACT, mobileHeaders, toMobileSearch } from "@/lib/mobile/catalog";
import { requestOrigin } from "@/lib/mobile/home";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const payload = await toMobileSearch(params.get("q") ?? "", requestOrigin(request), params.get("page"));
  return Response.json(payload, { headers: await mobileHeaders(MOBILE_SEARCH_CONTRACT) });
}
