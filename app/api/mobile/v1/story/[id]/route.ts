import { MOBILE_STORY_CONTRACT, mobileHeaders, toMobileStory } from "@/lib/mobile/catalog";
import { requestOrigin } from "@/lib/mobile/home";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const payload = await toMobileStory(id, requestOrigin(request));
  if (!payload) {
    return Response.json({ error: "المادة غير موجودة" }, { status: 404 });
  }
  return Response.json(payload, { headers: await mobileHeaders(MOBILE_STORY_CONTRACT) });
}
