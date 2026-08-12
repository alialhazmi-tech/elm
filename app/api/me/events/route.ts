import { getSessionMemberId, privateJson, recordMemberEvents } from "@/lib/personalization";

export async function POST(request: Request) {
  const memberId = await getSessionMemberId();
  if (!memberId) return privateJson({ error: "يلزم تسجيل الدخول" }, 401);
  const body = (await request.json().catch(() => null)) as { events?: unknown; memberId?: string } | null;
  void body?.memberId;
  const result = await recordMemberEvents(memberId, body?.events ?? []);
  return privateJson({ accepted: result.accepted });
}
