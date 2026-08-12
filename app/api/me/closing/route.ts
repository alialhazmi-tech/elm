import { getSessionMemberId, persistStatsAndSignal, privateJson } from "@/lib/personalization";

export async function POST(request: Request) {
  const memberId = await getSessionMemberId();
  if (!memberId) return privateJson({ error: "يلزم تسجيل الدخول" }, 401);
  const body = (await request.json().catch(() => null)) as { storyId?: string; answer?: number; memberId?: string } | null;
  const storyId = String(body?.storyId ?? "");
  if (!storyId) return privateJson({ error: "storyId مطلوب" }, 400);
  void body?.memberId;
  const answer = body?.answer === 1 ? 1 : 0;
  const stats = await persistStatsAndSignal(memberId, storyId, "closing_answer", new Date().toISOString(), { value: answer });
  return privateJson({ closingAnswer: stats?.closingAnswer ?? answer });
}
