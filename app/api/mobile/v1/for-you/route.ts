import { MOBILE_FOR_YOU_CONTRACT, toMobileForYou } from "@/lib/mobile/catalog";
import { getSessionMemberId, privateJson } from "@/lib/personalization";

export async function GET() {
  const memberId = await getSessionMemberId();
  if (!memberId) {
    return privateJson({ error: "يلزم تسجيل الدخول", contract: MOBILE_FOR_YOU_CONTRACT }, 401);
  }

  const payload = await toMobileForYou(memberId);
  return Response.json(payload, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Contract": MOBILE_FOR_YOU_CONTRACT,
    },
  });
}
