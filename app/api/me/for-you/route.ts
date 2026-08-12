import { forYouForMember, getSessionMemberId, privateJson } from "@/lib/personalization";

export async function GET() {
  const memberId = await getSessionMemberId();
  if (!memberId) return privateJson({ error: "يلزم تسجيل الدخول" }, 401);
  const items = await forYouForMember(memberId, 9);
  return privateJson({ items });
}
