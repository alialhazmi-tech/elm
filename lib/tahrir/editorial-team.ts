import { and, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { editorialNotes, editorialNotifications, editorialPresence, stories, userPermissions, users } from "@/db/schema";
import { loadRoleMap } from "./access";
import { hasPermission, LEGACY_ROLE_MAP, resolvePermissions, type OverrideEffect } from "./permissions";
import { assertCanWrite, assertExpectedVersion, StoryWriteError, type WriteActor } from "./write-policy";
import { auditQuery, lockStory, workflowDb } from "./workflow";

export async function teamStory(id: string, actor: WriteActor) {
  const [story] = await workflowDb().select({ id: stories.id, title: stories.title, authorId: stories.authorId, assignedTo: stories.assignedTo, dueAt: stories.dueAt, returnedAt: stories.returnedAt, revisionOf: stories.revisionOf, version: stories.version, status: stories.status }).from(stories).where(eq(stories.id, id)).limit(1);
  if (!story) throw new StoryWriteError("المادة غير موجودة.", 404);
  assertCanWrite(actor, story);
  return story;
}

export async function assignableEditors() {
  const db = workflowDb();
  const [members, overrides, roleMap] = await Promise.all([
    db.select({ id: users.id, name: users.displayName, role: users.role }).from(users).where(eq(users.status, "active")),
    db.select().from(userPermissions), loadRoleMap(),
  ]);
  return members.filter(member => {
    const permissions = resolvePermissions(roleMap.get(LEGACY_ROLE_MAP[member.role] ?? member.role)?.permissions ?? [],
      overrides.filter(row => row.userId === member.id).map(row => ({ permissionKey: row.permissionKey, effect: row.effect as OverrideEffect })));
    return hasPermission(permissions, "story.edit.own") || hasPermission(permissions, "story.edit.any");
  }).map(({ id, name }) => ({ id, name }));
}

export async function readTeam(id: string, actor: WriteActor) {
  const story = await teamStory(id, actor);
  const db = workflowDb();
  const [notes, editors] = await Promise.all([
    db.select().from(editorialNotes).where(eq(editorialNotes.storyId, story.revisionOf ?? id)).orderBy(desc(editorialNotes.createdAt), desc(editorialNotes.id)).limit(50),
    actor.can("story.edit.any") ? assignableEditors() : Promise.resolve([]),
  ]);
  const [assignee] = story.assignedTo ? await db.select({ name: users.displayName }).from(users).where(eq(users.id, story.assignedTo)).limit(1) : [];
  return { notes: notes.reverse(), editors, assignedTo: story.assignedTo, assigneeName: assignee?.name ?? null, dueAt: story.dueAt, returnedAt: story.returnedAt, version: story.version, canAssign: actor.can("story.edit.any"), canReturn: actor.can("story.approve") && story.status === "review" };
}

function notify(actor: WriteActor, storyId: string, recipients: Array<string | null>, message: string) {
  const ids = [...new Set(recipients.filter((id): id is string => !!id && id !== actor.userId))];
  return workflowDb().execute(sql`insert into editorial_notifications (id, user_id, story_id, message, created_at)
    select gen_random_uuid()::text, id, ${storyId}, ${message}, ${new Date().toISOString()} from users
    where ${ids.length ? inArray(users.id, ids) : sql`false`} and status = 'active'`);
}

export async function changeTeam(id: string, actor: WriteActor, input: Record<string, unknown>) {
  const story = await teamStory(id, actor);
  const db = workflowDb();
  const now = new Date().toISOString();
  if (story.status === "archived") throw new StoryWriteError("استعد المادة المؤرشفة أولًا.");
  if (input.action === "assign") {
    if (!actor.can("story.edit.any")) throw new StoryWriteError("الإسناد متاح لمن يملك تحرير جميع المواد.", 403);
    assertExpectedVersion(story.version, input.expectedVersion);
    const assignedTo = input.assignedTo === null ? null : typeof input.assignedTo === "string" ? input.assignedTo : undefined;
    const assignee = assignedTo ? (await assignableEditors()).find(user => user.id === assignedTo) : null;
    if (assignedTo === undefined || (assignedTo && !assignee)) throw new StoryWriteError("اختر محررًا فعّالًا من القائمة.", 400);
    const dueAt = input.dueAt === null || input.dueAt === "" ? null : typeof input.dueAt === "string" && Number.isFinite(Date.parse(input.dueAt)) ? new Date(input.dueAt).toISOString() : undefined;
    if (dueAt === undefined) throw new StoryWriteError("موعد التسليم غير صحيح.", 400);
    await db.batch([lockStory(story), db.update(stories).set({ assignedTo, dueAt, version: story.version + 1, updatedAt: now }).where(eq(stories.id, id)),
      auditQuery(actor.username, "story:assign", id, assignedTo ? `إسناد المادة إلى ${assignee?.name}` : "إلغاء الإسناد", { before: story, after: { assignedTo, dueAt } }),
      notify(actor, id, [assignedTo], `أسند ${actor.displayName} إليك مادة: ${story.title}`)]);
    return { version: story.version + 1, assignment: { assignedTo, assigneeName: assignee?.name ?? null, dueAt } };
  }
  if (input.action !== "comment" && input.action !== "return") throw new StoryWriteError("الإجراء غير صحيح.", 400);
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!body || body.length > 4000 || (input.action === "return" && body.length < 8)) throw new StoryWriteError("اكتب ملاحظة واضحة (سبب الإعادة 8 أحرف على الأقل، والحد الأقصى 4000 حرف).", 400);
  const returning = input.action === "return";
  if (returning) {
    if (!actor.can("story.approve")) throw new StoryWriteError("الإعادة للمحرر تتطلب صلاحية الاعتماد.", 403);
    assertExpectedVersion(story.version, input.expectedVersion);
    if (story.status !== "review") throw new StoryWriteError("الإعادة للمحرر متاحة للمواد المرسلة للاعتماد فقط.");
  }
  await db.batch([
    lockStory(story),
    db.insert(editorialNotes).values({ id: crypto.randomUUID(), storyId: story.revisionOf ?? id, authorId: actor.userId, authorName: actor.displayName, kind: returning ? "return" : "comment", body, createdAt: now }),
    ...(returning ? [db.update(stories).set({ status: "draft", returnedAt: now, version: story.version + 1, updatedAt: now }).where(eq(stories.id, id))] : []),
    auditQuery(actor.username, returning ? "story:return" : "story:comment", id, body, { before: story, after: returning ? { status: "draft", returnedAt: now } : {} }),
    notify(actor, id, [story.assignedTo, story.authorId], `${returning ? "أعاد" : "علّق"} ${actor.displayName} ${returning ? "مادة للتعديل" : "على مادة"}: ${story.title}`),
  ]);
  return { version: story.version + (returning ? 1 : 0), ...(returning ? { status: "draft" } : {}) };
}

/** A tab lease expires after 75 seconds. No background heartbeat while hidden. */
export async function updatePresence(id: string, actor: WriteActor, sessionId: string) {
  if (!/^[\da-f-]{36}$/i.test(sessionId)) throw new StoryWriteError("جلسة التحرير غير صحيحة.", 400);
  const story = await teamStory(id, actor);
  const storyId = story.revisionOf ?? id;
  const db = workflowDb();
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - 75_000).toISOString();
  await db.batch([
    db.delete(editorialPresence).where(lt(editorialPresence.seenAt, cutoff)),
    db.insert(editorialPresence).values({ storyId, userId: actor.userId, sessionId, seenAt: now }).onConflictDoUpdate({ target: [editorialPresence.storyId, editorialPresence.userId, editorialPresence.sessionId], set: { seenAt: now } }),
  ]);
  const rows = await db.select({ userId: users.id, name: users.displayName, sessionId: editorialPresence.sessionId }).from(editorialPresence)
    .innerJoin(users, eq(users.id, editorialPresence.userId))
    .where(and(eq(editorialPresence.storyId, storyId), gt(editorialPresence.seenAt, cutoff), eq(users.status, "active")));
  return rows.filter(row => row.userId !== actor.userId || row.sessionId !== sessionId).map(row => ({ userId: row.userId, name: row.userId === actor.userId ? "أنت في تبويب آخر" : row.name }));
}

export async function myNotifications(actor: WriteActor) {
  const allowed = actor.can("story.edit.any") ? sql`true` : actor.can("story.edit.own") ? or(eq(stories.authorId, actor.userId), eq(stories.assignedTo, actor.userId)) : sql`false`;
  return workflowDb().select({ id: editorialNotifications.id, storyId: stories.id, message: editorialNotifications.message, readAt: editorialNotifications.readAt, createdAt: editorialNotifications.createdAt }).from(editorialNotifications)
    .innerJoin(stories, eq(stories.id, editorialNotifications.storyId)).where(and(eq(editorialNotifications.userId, actor.userId), allowed)).orderBy(desc(editorialNotifications.createdAt)).limit(30);
}

export async function leavePresence(actor: WriteActor, sessionId: string) {
  if (!/^[\da-f-]{36}$/i.test(sessionId)) throw new StoryWriteError("جلسة التحرير غير صحيحة.", 400);
  await workflowDb().delete(editorialPresence).where(and(eq(editorialPresence.userId, actor.userId), eq(editorialPresence.sessionId, sessionId)));
}
