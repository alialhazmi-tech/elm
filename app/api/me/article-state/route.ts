import { getLiked, getSessionMemberId, loadStats, privateJson } from "@/lib/personalization";

export async function GET(request: Request) {
  const memberId = await getSessionMemberId();
  const storyId = new URL(request.url).searchParams.get("storyId") ?? "";
  if (!storyId) return privateJson({ error: "storyId مطلوب" }, 400);
  if (!memberId) {
    return privateJson({ signedIn: false, liked: false, closingAnswer: null });
  }
  const [liked, stats] = await Promise.all([getLiked(memberId, storyId), loadStats(memberId, storyId)]);
  return privateJson({
    signedIn: true,
    liked,
    closingAnswer: stats?.closingAnswer ?? null,
  });
}
