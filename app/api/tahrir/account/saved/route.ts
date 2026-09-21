import { requireActor } from "@/lib/tahrir/access";
import { editorSavedOwner } from "@/lib/personalization/saved-viewer";
import { setSaved } from "@/lib/personalization/saved";
import { privateJson } from "@/lib/personalization/session";
import { readingOrigin } from "@/lib/personalization/reading-input";

/** Removal in the administrative library always uses its own account, even with a member session. */
export async function POST(request: Request) {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;
  if (!readingOrigin(request)) return privateJson({ error: "طلب غير مسموح" }, 403);
  const body = await request.json().catch(() => null);
  const ownerId = editorSavedOwner(gate.actor.userId);
  if (body?.expectedMemberId !== ownerId) return privateJson({ error: "تغيّر الحساب" }, 409);
  if (typeof body?.storyId !== "string" || !body.storyId || body.storyId.length > 64 || body.saved !== false) return privateJson({ error: "طلب غير صالح" }, 400);
  await setSaved(ownerId, body.storyId, false);
  return privateJson({ saved: false });
}
