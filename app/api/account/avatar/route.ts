import { eq } from "drizzle-orm";
import { memberProfiles } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getMemberSession } from "@/lib/membership/session";
import { privateJson } from "@/lib/personalization/session";
import { readingOrigin } from "@/lib/personalization/reading-input";
import { AvatarError, readAvatarFile, storeAvatar } from "@/lib/storage/avatar";
import { consumeLimit } from "@/lib/tahrir/rate-limit";
async function change(request: Request, remove: boolean) {
  if (!readingOrigin(request))
    return privateJson({ error: "طلب غير مسموح." }, 403);
  try {
    const { data } = await getMemberSession();
    if (!data?.user)
      return privateJson({ error: "سجّل الدخول بحساب عضوية فعّال." }, 401);
    if (!(await consumeLimit("member-avatar", data.user.id, 10, 3600)))
      return privateJson({ error: "بلغت حد تغيير الصورة. حاول لاحقًا." }, 429);
    const image = remove
      ? null
      : await storeAvatar(await readAvatarFile(request));
    const db = getDb();
    if (!db) throw new Error("Database unavailable");
    const now = new Date().toISOString();
    if (remove)
      await db
        .update(memberProfiles)
        .set({ avatarUrl: null, updatedAt: now })
        .where(eq(memberProfiles.authUserId, data.user.id));
    else
      await db
        .insert(memberProfiles)
        .values({
          authUserId: data.user.id,
          avatarUrl: image,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: memberProfiles.authUserId,
          set: { avatarUrl: image, updatedAt: now },
        });
    return privateJson({ ok: true, image });
  } catch (error) {
    return privateJson(
      {
        error:
          error instanceof AvatarError
            ? error.message
            : "تعذر حفظ الصورة. حاول مرة أخرى.",
      },
      error instanceof AvatarError ? error.status : 503,
    );
  }
}
export function POST(request: Request) {
  return change(request, false);
}
export function DELETE(request: Request) {
  return change(request, true);
}
