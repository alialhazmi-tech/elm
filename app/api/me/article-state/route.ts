import { getSaved } from "@/lib/personalization/saved";
import { getLiked, getSessionMemberId, loadStats, privateJson } from "@/lib/personalization";

export async function GET(request: Request) {
  const memberId = await getSessionMemberId();
  const storyId = new URL(request.url).searchParams.get("storyId") ?? "";
  if (!storyId) return privateJson({ error: "storyId مطلوب" }, 400);
  if (!memberId) {
    return privateJson({ memberId: null, signedIn: false, liked: false, saved: false, closingAnswer: null });
  }
  const [liked, stats, saved] = await Promise.all([getLiked(memberId, storyId), loadStats(memberId, storyId), getSaved(memberId, storyId)]);
  return privateJson({
    memberId, signedIn: true,
    liked, saved,
    closingAnswer: stats?.closingAnswer ?? null,
  });
}
