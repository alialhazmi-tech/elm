import { getSessionMemberId, privateJson, setLiked } from "@/lib/personalization";

export async function POST(request: Request) {
  const memberId = await getSessionMemberId();
  if (!memberId) return privateJson({ error: "يلزم تسجيل الدخول" }, 401);
  const body = (await request.json().catch(() => null)) as { storyId?: string; liked?: boolean; memberId?: string } | null;
  const storyId = String(body?.storyId ?? "");
  if (!storyId) return privateJson({ error: "storyId مطلوب" }, 400);
  void body?.memberId;
  const liked = await setLiked(memberId, storyId, Boolean(body?.liked));
  return privateJson({ liked });
}
