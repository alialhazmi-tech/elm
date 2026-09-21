import { mobileBrowse, MOBILE_BROWSE_CONTRACT } from "@/lib/mobile/browse";
import { mobileHeaders } from "@/lib/mobile/catalog";
import { requestOrigin } from "@/lib/mobile/home";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const payload = await mobileBrowse(params.get("kind") ?? "section", params.get("slug") ?? "", params.get("page"), requestOrigin(request));
  if (!payload) return Response.json({ error: "Archive not found" }, { status: 404 });
  return Response.json(payload, { headers: await mobileHeaders(MOBILE_BROWSE_CONTRACT) });
}
