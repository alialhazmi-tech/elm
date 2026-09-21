import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { auditLog, stories, users } from "@/db/schema";
import { auditMeta } from "./audit-presentation";
import { workflowDb } from "./workflow";
import { assertCanWrite, StoryWriteError, type WriteActor } from "./write-policy";
import type { StoryAuditContext } from "./story-audit";

export async function storyTimeline(id: string, actor: WriteActor, input: { cursor?: string | null; eventId?: string | null } = {}) {
  const db = workflowDb();
  const [story] = await db.select({ id: stories.id, title: stories.title, authorId: stories.authorId, assignedTo: stories.assignedTo, revisionOf: stories.revisionOf }).from(stories).where(eq(stories.id, id)).limit(1);
  if (!story) throw new StoryWriteError("المادة غير موجودة.", 404);
  assertCanWrite(actor, story);
  const rootId = story.revisionOf ?? story.id;
  const family = await db.select({ id: stories.id }).from(stories).where(and(or(eq(stories.id, rootId), eq(stories.revisionOf, rootId)),
    actor.can("story.edit.any") ? undefined : or(eq(stories.authorId, actor.userId), eq(stories.assignedTo, actor.userId))));
  const allowedIds = family.map(row => row.id);
  // An assignee of one revision must not see private drafts belonging to another editor.
  const scope = or(inArray(auditLog.storyId, allowedIds), actor.can("story.edit.any") ? sql`${auditLog.context}->>'rootStoryId' = ${rootId}` : undefined,
    actor.can("story.edit.any") ? sql`${auditLog.storyId} in (select story_id from audit_log where action='revision:create' and detail=${rootId})` : undefined);
  let cursor: { at: string; id: string } | null = null;
  if (input.cursor) {
    try {
      if (input.cursor.length > 600) throw new Error();
      cursor = JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8"));
      if (!cursor || typeof cursor.at !== "string" || cursor.at.length > 80 || !Number.isFinite(Date.parse(cursor.at)) || typeof cursor.id !== "string" || cursor.id.length > 100) throw new Error();
    } catch { throw new StoryWriteError("مؤشر السجل غير صحيح. حدّث السجل.", 400); }
  }
  const context = input.eventId ? auditLog.context : sql`case when ${auditLog.context} is null then null else (${auditLog.context} - 'changes') || jsonb_build_object('changes',coalesce((select jsonb_agg(jsonb_build_object('field',change->>'field','label',change->>'label')) from jsonb_array_elements(coalesce(${auditLog.context}->'changes','[]'::jsonb)) change),'[]'::jsonb)) end`;
  const rows = await db.select({ id: auditLog.id, at: auditLog.at, actor: auditLog.actor, currentName: users.displayName, action: auditLog.action, storyId: auditLog.storyId, detail: auditLog.detail, context }).from(auditLog)
    .leftJoin(users, eq(users.username, auditLog.actor))
    .where(and(scope, input.eventId ? eq(auditLog.id, input.eventId) : undefined,
      !input.eventId && cursor ? or(lt(auditLog.at, cursor.at), and(eq(auditLog.at, cursor.at), lt(auditLog.id, cursor.id))) : undefined))
    .orderBy(desc(auditLog.at), desc(auditLog.id)).limit(input.eventId ? 1 : 31);
  if (input.eventId && !rows.length) throw new StoryWriteError("الحدث غير متاح ضمن سجل هذه المادة.", 404);
  const events = rows.slice(0, 30).map(row => {
    const data = row.context as StoryAuditContext | null;
    const meta = auditMeta(row.action);
    const legacyDetail = row.action.startsWith("ai:") ? aiDetail(row.action, row.detail) : row.action === "revision:create" ? "إنشاء مسودة تعديل مرتبطة بالمادة الأصلية" : row.action === "story:assign" && !data ? legacyAssignment(row.detail) : row.detail;
    return { id: row.id, at: row.at, actorName: data?.actorName ?? row.currentName ?? row.actor, action: row.action,
      label: row.action === "draft:save" && data?.saveMode === "automatic" ? "حفظ تلقائي" : meta.label,
      tone: meta.tone, storyId: row.storyId, isRevision: row.storyId !== rootId, detail: legacyDetail,
      recordedDetails: data !== null, fields: data?.changes?.map(change => change.label) ?? [],
      ...(input.eventId ? { changes: data?.changes ?? [], references: data?.references ?? {} } : {}) };
  });
  const last = rows[29];
  return { title: story.title, events, nextCursor: rows.length > 30 && last ? Buffer.from(JSON.stringify({ at: last.at, id: last.id })).toString("base64url") : null };
}

function aiDetail(action: string, detail: string) {
  if (["ai:started", "ai:blocked", "ai:failed"].includes(action)) return auditMeta(`ai:${detail.replace(/^تعذر إكمال /, "")}`).label;
  return "اكتمل التوليد. تظهر التغييرات المطبّقة في سجل حفظ المادة.";
}

function legacyAssignment(detail: string) {
  try { const value = JSON.parse(detail); return `${value.assignedTo ? "حفظ إسناد المادة" : "إلغاء الإسناد"}${value.dueAt ? ` · موعد التسليم: ${new Date(value.dueAt).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh" })} (الرياض)` : ""}`; } catch { return detail; }
}
