import { MOBILE_KEYWORDS_CONTRACT, mobileHeaders, toMobileKeywords } from "@/lib/mobile/catalog";
import { requestOrigin } from "@/lib/mobile/home";

export async function GET(request: Request, context: { params: Promise<{ keyword: string }> }) {
  const { keyword } = await context.params;
  const page = new URL(request.url).searchParams.get("page");
  const payload = await toMobileKeywords(keyword, page, requestOrigin(request));
  if (!payload) return Response.json({ error: "لا مواد لهذه الكلمة" }, { status: 404 });
  return Response.json(payload, { headers: await mobileHeaders(MOBILE_KEYWORDS_CONTRACT) });
}
