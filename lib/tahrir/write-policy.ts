export interface WriteActor {
  userId: string;
  username: string;
  displayName: string;
  mustChangePassword: boolean;
  can(key: string): boolean;
}

export class StoryWriteError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

export function assertCanWrite(actor: WriteActor, story: { authorId: string | null } | null) {
  if (actor.mustChangePassword) throw new StoryWriteError("غيّر كلمة المرور المؤقتة أولًا.", 403);
  const allowed = story
    ? actor.can("story.edit.any") || (actor.can("story.edit.own") && story.authorId === actor.userId)
    : actor.can("story.create");
  if (!allowed) throw new StoryWriteError("لا تملك صلاحية تحرير هذه المادة.", 403);
}

export function assertExpectedVersion(actual: number, expected: unknown) {
  if (actual !== expected) throw new StoryWriteError("تغيّرت المادة منذ فتحها. أعد تحميلها قبل الحفظ؛ بقيت تعديلاتك في المحرر.");
}

export function stableIdentity(existing: { slug: string; section: string } | null, input: { slug?: string; section?: string }, id: string) {
  if (existing) return { slug: existing.slug, section: existing.section };
  const slug = (input.slug ?? "").normalize("NFC").trim().toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 200);
  return { slug: slug || `story-${id.slice(0, 8)}`, section: input.section || "news" };
}

export function writeError(error: unknown): Response {
  if (error instanceof StoryWriteError) return Response.json({ error: error.message }, { status: error.status });
  let cause: unknown = error;
  for (let i = 0; i < 5 && cause && typeof cause === "object"; i++) {
    if ("code" in cause && cause.code === "40001") {
      return Response.json({ error: "تغيّرت المادة أثناء العملية. أعد تحميل أحدث نسخة." }, { status: 409 });
    }
    cause = "cause" in cause ? cause.cause : null;
  }
  throw error;
}
