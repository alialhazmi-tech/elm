import { MOBILE_FOR_YOU_CONTRACT, toMobileForYou } from "@/lib/mobile/catalog";
import { requestOrigin } from "@/lib/mobile/home";
import { getSessionMemberId, privateJson } from "@/lib/personalization";

export async function GET(request: Request) {
  const memberId = await getSessionMemberId();
  if (!memberId) {
    return privateJson({ error: "يلزم تسجيل الدخول", contract: MOBILE_FOR_YOU_CONTRACT }, 401);
  }

  const payload = await toMobileForYou(memberId, 9, requestOrigin(request));
  return Response.json(payload, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Contract": MOBILE_FOR_YOU_CONTRACT,
    },
  });
}
