import { eq } from "drizzle-orm";
import { users, auditLog } from "@/db/schema";
import { getDb } from "@/lib/db";
import { privateJson } from "@/lib/personalization/session";
import { readingOrigin } from "@/lib/personalization/reading-input";
import { requireActor } from "@/lib/tahrir/access";
import { AvatarError, readAvatarFile, storeAvatar } from "@/lib/storage/avatar";
import { consumeLimit } from "@/lib/tahrir/rate-limit";
async function change(request: Request, mode: "name" | "image" | "remove") {
  if (!readingOrigin(request))
    return privateJson({ error: "طلب غير مسموح." }, 403);
  const started = performance.now();
  let stage = "session";
  try {
    const gate = await requireActor();
    if (!gate.ok) return gate.response;
    stage = "rate-limit";
    if (!(await consumeLimit("editor-profile", gate.actor.userId, 20, 3600)))
      return privateJson({ error: "محاولات كثيرة. حاول لاحقًا." }, 429);
    const patch: {
      displayName?: string;
      avatarUrl?: string | null;
      updatedAt: string;
    } = { updatedAt: new Date().toISOString() };
    if (mode === "name") {
      const body = await request.json().catch(() => null);
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (name.length < 2 || name.length > 80)
        return privateJson({ error: "اكتب اسمًا من حرفين إلى 80 حرفًا." }, 400);
      patch.displayName = name;
    } else if (mode === "remove") patch.avatarUrl = null;
    else {
      stage = "upload";
      const file = await readAvatarFile(request);
      console.info(JSON.stringify({ event: "profile-avatar:received", bytes: file.size, elapsedMs: Math.round(performance.now() - started) }));
      stage = "storage";
      patch.avatarUrl = await storeAvatar(file);
    }
    stage = "database";
    const db = getDb();
    if (!db) throw new Error("Database unavailable");
    await db.batch([
      db.update(users).set(patch).where(eq(users.id, gate.actor.userId)),
      db
        .insert(auditLog)
        .values({
          id: crypto.randomUUID(),
          at: patch.updatedAt,
          actor: gate.actor.username,
          action: "users:profile",
          detail: `${gate.actor.userId}: ${mode}`,
        }),
    ]);
    return privateJson({ ok: true, image: patch.avatarUrl });
  } catch (error) {
    console.warn(JSON.stringify({ event: "profile:failed", mode, stage, elapsedMs: Math.round(performance.now() - started), status: error instanceof AvatarError ? error.status : 503 }));
    return privateJson(
      {
        error:
          error instanceof AvatarError
            ? error.message
            : "تعذر حفظ الملف الشخصي.",
      },
      error instanceof AvatarError ? error.status : 503,
    );
  }
}
export function PATCH(request: Request) {
  return change(request, "name");
}
export function POST(request: Request) {
  return change(request, "image");
}
export function DELETE(request: Request) {
  return change(request, "remove");
}
