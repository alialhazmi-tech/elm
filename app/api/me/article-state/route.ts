import { getSaved } from "@/lib/personalization/saved";
import { getSavedViewer } from "@/lib/personalization/saved-viewer";
import { getLiked, loadStats } from "@/lib/personalization/likes";
import { getSessionMemberId, privateJson } from "@/lib/personalization/session";

export async function GET(request: Request) {
  const memberId = await getSessionMemberId();
  const storyId = new URL(request.url).searchParams.get("storyId") ?? "";
  if (!storyId) return privateJson({ error: "storyId مطلوب" }, 400);
  const viewer = await getSavedViewer(memberId);
  const saved = viewer.ownerId ? await getSaved(viewer.ownerId, storyId) : false;
  const saving = { saved, saveOwnerId: viewer.ownerId, saveLoginHref: viewer.signInHref };
  if (!memberId) {
    return privateJson({ memberId: null, signedIn: false, liked: false, ...saving, closingAnswer: null });
  }
  const [liked, stats] = await Promise.all([getLiked(memberId, storyId), loadStats(memberId, storyId)]);
  return privateJson({
    memberId, signedIn: true,
    liked, ...saving,
    closingAnswer: stats?.closingAnswer ?? null,
  });
}
