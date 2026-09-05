import { getSessionMemberId } from "@/lib/personalization/session";
import { loadActor } from "@/lib/tahrir/access";

/** Administrative saves never impersonate or auto-link an audience account. */
export const editorSavedOwner = (userId: string) => `tahrir:${userId}`;

export async function getSavedViewer(memberId?: string | null) {
  const member = memberId === undefined ? await getSessionMemberId() : memberId;
  // Match the public header: the audience membership is primary when both exist.
  if (member) return { ownerId: member, signInHref: null };
  const actor = await loadActor();
  if (!actor) return { ownerId: null, signInHref: null };
  if (actor.mustChangePassword) return { ownerId: null, signInHref: "/tahrir/password" };
  return { ownerId: editorSavedOwner(actor.userId), signInHref: null };
}
