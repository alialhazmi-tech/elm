/** طبقة بيانات «تحرير العلم»: استعلامات اللوحة، حفظ المسودات، سير الاعتماد، وسجل التدقيق. */

import { storySearchRank, storySearchWhere } from "./story-search";
import { cache } from "react";
import { and, asc, desc, eq, ilike, inArray, ne, sql, type SQL } from "drizzle-orm";

import { auditLog, stories, users } from "@/db/schema";
import { stripHtmlToText } from "@/lib/content/html";
import { getDb } from "@/lib/db";
import { assertCanWrite, assertExpectedVersion, stableIdentity, StoryWriteError, type WriteActor } from "./write-policy";
import { cachedStatusCounts, invalidateStatusCounts } from "./status-counts";
import { riyadhDayBounds, riyadhDayKeys } from "./time";
import { auditQuery, copySlides, copySource, lockStory, publishCheckedStory, snapshotQuery } from "./workflow";
import { usernameEquals } from "./username";

export { invalidateStatusCounts };

export type StoryRow = typeof stories.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type StoryStatus = "draft" | "review" | "scheduled" | "published" | "archived";

export const STATUS_LABELS: Record<StoryStatus, string> = {
  draft: "مسودة",
  review: "بانتظار الاعتماد",
  scheduled: "مجدول",
  published: "منشور",
  archived: "مؤرشفة",
};

export const ACTIVE_STATUSES = ["published", "review", "scheduled", "draft"] as const satisfies StoryStatus[];
export const ARCHIVE_ACTION = "story:archive";
export const RESTORE_ACTION = "story:restore";
export const PULSE_ACTION = "story:pulse";

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("قاعدة البيانات غير مهيأة — «تحرير العلم» يتطلب DATABASE_URL.");
  return db;
}

export async function findUser(username: string): Promise<UserRow | null> {
  const db = requireDb();
  const rows = await db.select().from(users).where(usernameEquals(username)).limit(2);
  // لا نختار حسابًا عشوائيًا إذا لم يُطبّق الفهرس بعد وكانت هناك أسماء متعارضة.
  if (rows.length > 1) throw new Error("AMBIGUOUS_USERNAME");
  return rows[0] ?? null;
}

export async function audit(actor: string, action: string, storyId?: string, detail = "") {
  if (storyId) { await auditQuery(actor, action, storyId, detail); return; }
  const db = requireDb();
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor,
    action,
    storyId,
    detail,
  });
}

export async function getStory(id: string): Promise<StoryRow | null> {
  const db = requireDb();
  const rows = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  return rows[0] ?? null;
}

export interface DraftInput {
  id: string;
  expectedVersion?: number;
  returnToDraft?: boolean;
  autosave?: boolean;
  updateScheduled?: boolean;
  rescheduleAt?: string;
  title: string;
  excerpt: string;
  body: string;
  section: string;
  slug: string;
  seriesSlug: string | null;
  image: string | null;
  format?: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];
  /** رابط يوتيوب أو تغريدة X لمواد الفيديو — null يمسحه. */
  videoUrl?: string | null;
  /** undefined = لا تغيير — مسار الحفظ يفحص صلاحية التثبيت والعاجل كلًا على حدة. */
  pinned?: boolean;
  breakingUntil?: string | null;
}

export async function saveDraft(input: DraftInput, actor: WriteActor) {
  const db = requireDb();
  const now = new Date().toISOString();

  const privileged = {
    ...(input.format !== undefined ? { format: input.format } : {}),
    ...(input.pinned !== undefined ? { pinned: input.pinned ? 1 : 0 } : {}),
    ...(input.breakingUntil !== undefined ? { breakingUntil: input.breakingUntil } : {}),
  };
  const seo = {
    ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle || null } : {}),
    ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription || null } : {}),
    ...(input.keywords !== undefined ? { keywords: input.keywords } : {}),
    ...(input.videoUrl !== undefined ? { videoUrl: input.videoUrl || null } : {}),
  };
  // دقائق القراءة من نص المتن الفعلي — 200 كلمة/دقيقة بين 1 و15.
  const words = stripHtmlToText(input.body).split(/\s+/u).filter(Boolean).length;
  const readingMinutes = Math.min(15, Math.max(1, Math.round(words / 200) || 1));

  const existing = await getStory(input.id);
  assertCanWrite(actor, existing);
  if (existing) assertExpectedVersion(existing.version, input.expectedVersion);
  if (existing?.status === "archived") throw new StoryWriteError("استعد المادة المؤرشفة قبل تحريرها.");
  if (input.returnToDraft) {
    if (!actor.can("story.publish")) throw new StoryWriteError("التحويل إلى مسودة من صلاحية المعتمدين فقط.", 403);
    if (existing?.status !== "published" || existing.revisionOf) throw new StoryWriteError("التحويل إلى مسودة متاح للمادة المنشورة فقط.");
  }
  const fork = !input.returnToDraft && existing && ["published", "scheduled"].includes(existing.status);
  const id = fork ? crypto.randomUUID() : input.id;
  // الحفظ التلقائي يبدأ مبكرًا؛ تبقى هوية المسودة الجديدة قابلة للاستكمال.
  // المنشور ومسودات تعديله يحافظان على الرابط والقسم المعتمدين.
  const identity = stableIdentity(existing?.status === "draft" && !existing.revisionOf && !existing.publishedAt ? null : existing, input, id);
  const content = {
    ...identity, title: input.title, excerpt: input.excerpt, body: input.body,
    seriesSlug: input.seriesSlug, image: input.image, updatedAt: now, readingMinutes,
    ...privileged, ...seo,
  };
  if (input.updateScheduled) {
    if (!actor.can("story.schedule")) throw new StoryWriteError("لا تملك صلاحية تحديث المادة المجدولة.", 403);
    if (!existing || existing.status !== "scheduled" || !existing.scheduledAt || input.autosave || input.returnToDraft) {
      throw new StoryWriteError("تغيّرت حالة المادة؛ أعد تحميلها قبل تحديث المجدول.");
    }
    if (input.rescheduleAt !== undefined && (!Number.isFinite(Date.parse(input.rescheduleAt)) || Date.parse(input.rescheduleAt) <= Date.now())) {
      throw new StoryWriteError("اختر موعدًا مستقبليًا صحيحًا.", 400);
    }
    const scheduledAt = input.rescheduleAt === undefined ? existing.scheduledAt : new Date(input.rescheduleAt).toISOString();
    await db.batch([
      lockStory(existing),
      snapshotQuery(existing.id, actor.username),
      db.update(stories).set({ ...content, scheduledAt, version: existing.version + 1 }).where(eq(stories.id, existing.id)),
      auditQuery(actor.username, "scheduled:update", existing.id, input.rescheduleAt ? "تعديل المحتوى وموعد النشر" : "حفظ التعديلات مع إبقاء موعد النشر", { before: existing, after: { ...content, scheduledAt }, saveMode: "manual" }),
    ]);
    return { id: existing.id, ...identity, version: existing.version + 1, status: "scheduled", revisionOf: existing.revisionOf, scheduledAt };
  }
  if (!existing || fork) {
    const insert = db.insert(stories).values({
      ...(existing ?? {}), ...content, id, status: "draft", scheduledAt: null,
      authorId: actor.userId, authorName: actor.displayName, version: 1,
      revisionOf: existing?.revisionOf ?? existing?.id ?? null, baseVersion: existing?.baseVersion ?? existing?.version ?? null,
    });
    if (existing) {
      await db.batch([lockStory(existing), insert, copySlides(existing.id, id), copySource(existing.id, id), auditQuery(actor.username, "revision:create", id, existing.id, { before: existing, after: { ...content, status: "draft", scheduledAt: null, authorId: actor.userId, authorName: actor.displayName, revisionOf: existing.revisionOf ?? existing.id }, saveMode: input.autosave ? "automatic" : "manual" })]);
    } else {
      await db.batch([insert, auditQuery(actor.username, "draft:create", id, "", { after: { ...content, status: "draft", authorId: actor.userId, authorName: actor.displayName }, saveMode: input.autosave ? "automatic" : "manual" })]);
    }
    invalidateStatusCounts();
    return { id, ...identity, version: 1, status: "draft", revisionOf: existing?.revisionOf ?? existing?.id ?? null };
  }
  await db.batch([
    lockStory(existing),
    ...(input.returnToDraft ? [snapshotQuery(id, actor.username)] : []),
    db.update(stories).set({ ...content, status: "draft", scheduledAt: null, version: existing.version + 1 }).where(eq(stories.id, id)),
    auditQuery(actor.username, input.returnToDraft ? "story:unpublish" : "draft:save", id, "", { before: existing, after: { ...content, status: "draft", scheduledAt: null }, saveMode: input.autosave ? "automatic" : "manual" }),
  ]);
  if (existing.status !== "draft") invalidateStatusCounts();
  return { id, ...identity, version: existing.version + 1, status: "draft", revisionOf: existing.revisionOf };
}

export async function setStatus(
  checked: StoryRow,
  status: "review" | "published",
  actor: string,
  detail = "",
) {
  if (status === "published") return publishCheckedStory(checked, actor, detail);
  if (!["draft", "review"].includes(checked.status)) throw new StoryWriteError("يمكن رفع المسودة فقط للاعتماد.");
  const db = requireDb();
  await db.batch([
    lockStory(checked),
    db.update(stories).set({ status, returnedAt: null, updatedAt: new Date().toISOString(), version: checked.version + 1 }).where(eq(stories.id, checked.id)),
    auditQuery(actor, `status:${status}`, checked.id, detail, { before: checked, after: { status, returnedAt: null } }),
  ]);
  invalidateStatusCounts();
  return { id: checked.id, slug: checked.slug, section: checked.section, version: checked.version + 1 };
}

export type DeleteDraftResult = "deleted" | "not-found" | "not-draft";

/** حذف دائم لمسودة فقط؛ المواد في سير الاعتماد أو المنشورة لا تمس. */
export async function deleteDraft(id: string, actor: string): Promise<DeleteDraftResult> {
  const db = requireDb();
  const rows = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  const story = rows[0];
  if (!story) return "not-found";
  if (story.status !== "draft") return "not-draft";

  // تعليمة واحدة ذرّية: إن تغيرت الحالة بالتزامن لا تُحذف المادة ولا توابعها ولا يُكتب سجل مضلل.
  const result = await db.execute<{ storyId: string }>(sql`
    with deleted_story as (
      delete from stories
      where id = ${id} and status = 'draft'
      returning id, title, revision_of
    ), deleted_slides as (
      delete from story_slides where story_id in (select id from deleted_story)
    ), deleted_source as (
      delete from jak_sources where story_id in (select id from deleted_story)
    )
    insert into audit_log (id, at, actor, action, story_id, detail, context)
    select ${crypto.randomUUID()}, ${new Date().toISOString()}, ${actor}, 'draft:delete', id, title,
      jsonb_build_object('v',1,'rootStoryId',coalesce(revision_of,id),'actorId',(select u.id from users u where u.username=${actor} limit 1),
        'actorName',coalesce((select display_name from users where username=${actor} limit 1),${actor}),'changes','[]'::jsonb)
    from deleted_story
    returning story_id as "storyId"
  `);
  if (result.rows.length > 0) invalidateStatusCounts();
  return result.rows.length > 0 ? "deleted" : "not-draft";
}

const MIN_ARCHIVE_REASON = 8;

export type ArchiveResult = "archived" | "not-found" | "already-archived" | "is-draft" | "short-reason";
export type RestoreResult = "restored" | "not-found" | "not-archived";

export interface ArchiveEvent {
  at: string;
  actor: string;
  reason: string;
}

/** إخفاء منطقي عن الموقع العام — المادة تبقى في تاب المؤرشفة مع السبب والتاريخ. */
export async function archiveStory(
  id: string,
  actor: string,
  reason: string,
): Promise<ArchiveResult> {
  const trimmed = reason.replace(/\s+/g, " ").trim();
  if (trimmed.length < MIN_ARCHIVE_REASON) return "short-reason";

  const db = requireDb();
  const story = (await db.select().from(stories).where(eq(stories.id, id)).limit(1))[0];
  if (!story) return "not-found";
  if (story.status === "archived") return "already-archived";
  if (story.status === "draft") return "is-draft";

  const now = new Date().toISOString();
  await db.batch([lockStory(story), db
    .update(stories)
    .set({
      status: "archived",
      version: sql`${stories.version} + 1`,
      scheduledAt: null,
      updatedAt: now,
      pinned: 0,
      breakingUntil: null,
    })
    .where(eq(stories.id, id)), auditQuery(actor, ARCHIVE_ACTION, id, trimmed, { before: story, after: { status: "archived", scheduledAt: null, pinned: 0, breakingUntil: null } })]);
  invalidateStatusCounts();
  return "archived";
}

/**
 * يرفع مادة منشورة إلى صدارة الرئيسية وقسمها وسلسلتها.
 * تاريخ النشر الأصلي يبقى كما هو؛ الترتيب العام يقرأ boosted_at ثم published_at.
 */
export async function pulseStory(id: string, expectedVersion: number, actor: string) {
  const db = requireDb();
  const story = (await db.select().from(stories).where(eq(stories.id, id)).limit(1))[0];
  if (!story) throw new StoryWriteError("المادة غير موجودة.", 404);
  assertExpectedVersion(story.version, expectedVersion);
  if (story.revisionOf) throw new StoryWriteError("النبض للنسخة المنشورة على الموقع. اعتمد مسودة التعديل أولًا.");
  if (story.status !== "published") throw new StoryWriteError("النبض متاح للمادة المنشورة فقط.");

  const now = new Date().toISOString();
  await db.batch([
    lockStory(story),
    db.update(stories).set({ boostedAt: now, version: story.version + 1 }).where(eq(stories.id, id)),
    auditQuery(actor, PULSE_ACTION, id, "رفع الظهور إلى صدارة الرئيسية والقسم والسلسلة", { before: story, after: { boostedAt: now } }),
  ]);
  return { id: story.id, slug: story.slug, section: story.section, version: story.version + 1, boostedAt: now };
}

/** إعادة المادة المؤرشفة إلى مسودة — لا تظهر على الموقع حتى يُعاد نشرها. */
export async function restoreArchived(id: string, actor: string): Promise<RestoreResult> {
  const db = requireDb();
  const story = (await db.select().from(stories).where(eq(stories.id, id)).limit(1))[0];
  if (!story) return "not-found";
  if (story.status !== "archived") return "not-archived";

  const now = new Date().toISOString();
  await db.batch([lockStory(story), db
    .update(stories)
    .set({ status: "draft", scheduledAt: null, version: story.version + 1, updatedAt: now })
    .where(eq(stories.id, id)), auditQuery(actor, RESTORE_ACTION, id, "استعادة من الأرشيف إلى مسودة", { before: story, after: { status: "draft", scheduledAt: null } })]);
  invalidateStatusCounts();
  return "restored";
}

/** أحدث حدث أرشفة لكل مادة — لعرض التاريخ والسبب في تاب المؤرشفة. */
export async function latestArchiveEvents(ids: string[]): Promise<Map<string, ArchiveEvent>> {
  const map = new Map<string, ArchiveEvent>();
  if (ids.length === 0) return map;
  const db = requireDb();
  const rows = await db
    .select()
    .from(auditLog)
    .where(and(inArray(auditLog.storyId, ids), eq(auditLog.action, ARCHIVE_ACTION)))
    .orderBy(desc(auditLog.at));
  for (const row of rows) {
    if (!row.storyId || map.has(row.storyId)) continue;
    map.set(row.storyId, { at: row.at, actor: row.actor, reason: row.detail });
  }
  return map;
}

/* ============ المرحلة 2 ============ */

import { media, seriesProposals } from "@/db/schema";
import { loadAiSettings } from "@/lib/ai/settings";
import { runConfiguredPolicyGuard } from "@/lib/policy";
import { buildGuardDraft, loadGuardContext } from "./guard-draft";

export type MediaRow = typeof media.$inferSelect;
export type ProposalRow = typeof seriesProposals.$inferSelect;

export type MediaFilter = "all" | "ok" | "pending";

function mediaWhere(filter: MediaFilter, q: string | undefined): SQL | undefined {
  const clauses: SQL[] = [];
  if (filter === "ok") clauses.push(eq(media.rightsCleared, 1));
  if (filter === "pending") clauses.push(eq(media.rightsCleared, 0));
  if (q?.trim()) clauses.push(ilike(media.filename, titlePattern(q)));
  return clauses.length ? and(...clauses) : undefined;
}

/** صفحة من مكتبة الوسائط — المكتبة ~29 ألف صورة فلا تُجلب دفعة واحدة أبدًا. */
export async function listMediaPage(
  filter: MediaFilter,
  page: number,
  perPage: number,
  q?: string,
): Promise<MediaRow[]> {
  const db = requireDb();
  const query = db.select().from(media).orderBy(desc(media.createdAt)).limit(perPage).offset(Math.max(0, page - 1) * perPage);
  const where = mediaWhere(filter, q);
  return where ? query.where(where) : query;
}

/** عدّادات المكتبة بضربة واحدة: الكل، موثقة الحقوق، بانتظار التوثيق — مع مرشّح البحث إن وُجد. */
export async function countMedia(q?: string): Promise<Record<MediaFilter, number>> {
  const db = requireDb();
  const query = db
    .select({ rightsCleared: media.rightsCleared, count: sql<number>`count(*)` })
    .from(media)
    .groupBy(media.rightsCleared);
  const where = mediaWhere("all", q);
  const rows = await (where ? query.where(where) : query);
  const ok = Number(rows.find((row) => row.rightsCleared === 1)?.count ?? 0);
  const pending = Number(rows.find((row) => row.rightsCleared !== 1)?.count ?? 0);
  return { all: ok + pending, ok, pending };
}

/** أحدث الصور لمصغّرات المحرر وجاك العلم وتوليد الصور — بحدّ صغير بدل المكتبة كلها. */
export async function listRecentMedia(options: {
  rightsCleared?: boolean;
  aiGenerated?: boolean;
  limit: number;
}): Promise<MediaRow[]> {
  const db = requireDb();
  const clauses: SQL[] = [];
  if (options.rightsCleared !== undefined) clauses.push(eq(media.rightsCleared, options.rightsCleared ? 1 : 0));
  if (options.aiGenerated !== undefined) clauses.push(eq(media.aiGenerated, options.aiGenerated ? 1 : 0));
  const query = db.select().from(media).orderBy(desc(media.createdAt)).limit(options.limit);
  return clauses.length ? query.where(and(...clauses)!) : query;
}

export async function addMedia(row: Omit<MediaRow, "createdAt">, actor: string) {
  const db = requireDb();
  await db.insert(media).values({ ...row, createdAt: new Date().toISOString() });
  await audit(actor, "media:upload", undefined, row.filename);
}

export async function setMediaRights(
  id: string,
  rightsCleared: boolean,
  flags: string,
  actor: string,
) {
  const db = requireDb();
  await db
    .update(media)
    .set({ rightsCleared: rightsCleared ? 1 : 0, flags })
    .where(eq(media.id, id));
  await audit(actor, rightsCleared ? "media:rights-cleared" : "media:rights-revoked", undefined, id);
}

export async function findMediaByUrl(url: string): Promise<MediaRow | null> {
  const db = requireDb();
  const rows = await db.select().from(media).where(eq(media.url, url)).limit(1);
  return rows[0] ?? null;
}

export async function listProposals(): Promise<ProposalRow[]> {
  const db = requireDb();
  return db.select().from(seriesProposals).orderBy(desc(seriesProposals.createdAt));
}

export async function addProposal(
  input: Pick<ProposalRow, "name" | "valueCase" | "gapCase" | "impactCase">,
  actor: string,
) {
  const db = requireDb();
  await db.insert(seriesProposals).values({
    id: crypto.randomUUID(),
    ...input,
    proposedBy: actor,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  await audit(actor, "series:proposal", undefined, input.name);
}

export async function decideProposal(id: string, decision: "accepted" | "rejected", actor: string) {
  const db = requireDb();
  await db.update(seriesProposals).set({ status: decision }).where(eq(seriesProposals.id, id));
  await audit(actor, `series:proposal-${decision}`, undefined, id);
}

export async function scheduleStory(story: StoryRow, scheduledAt: string, actor: string) {
  if (!["draft", "review"].includes(story.status)) throw new StoryWriteError("احفظ مسودة قبل الجدولة.");
  const db = requireDb();
  await db.batch([
    lockStory(story),
    db.update(stories).set({ status: "scheduled", scheduledAt, updatedAt: new Date().toISOString(), version: story.version + 1 }).where(eq(stories.id, story.id)),
    auditQuery(actor, "status:scheduled", story.id, `الموعد ${scheduledAt}`, { before: story, after: { status: "scheduled", scheduledAt } }),
  ]);
  invalidateStatusCounts();
  return { version: story.version + 1 };
}

/** أقرب موعد جدولة قائم (ولو مضى ولم يُرقَّ بعد) — لتقرير وتيرة تحديث صفحة الجدولة. */
export async function nextScheduledAt(): Promise<string | null> {
  const db = requireDb();
  const [row] = await db
    .select({ at: sql<string | null>`min(${stories.scheduledAt})` })
    .from(stories)
    .where(and(eq(stories.status, "scheduled"), sql`${stories.scheduledAt} is not null`));
  return row?.at ?? null;
}

export interface PromotedStory { id: string; section: string; slug: string }
export async function promoteDueScheduled(): Promise<PromotedStory[]> {
  const db = requireDb();
  const now = new Date().toISOString();
  const due = await db.select().from(stories)
    .where(and(eq(stories.status, "scheduled"), sql`${stories.scheduledAt} <= ${now}`)).orderBy(asc(stories.scheduledAt), asc(stories.id)).limit(100);
  if (!due.length) return [];
  const settings = await loadAiSettings();
  // مسودة الحارس نفسها التي تُفحص عند الاعتماد اليدوي؛ عدّاد العاجل يتقدم محليًا داخل الدفعة.
  const context = await loadGuardContext(settings);
  const promoted: PromotedStory[] = [];
  try {
  for (const story of due) {
    const draft = buildGuardDraft({ id: story.id, title: story.title, body: story.body, format: story.format, image: story.image, breakingUntil: story.breakingUntil, media: await guardMediaFor(story.image) });
    const report = runConfiguredPolicyGuard(draft, settings.governance, context);
    try {
      if (report.canRequestApproval) {
        promoted.push(await publishCheckedStory(story, "النظام", "نشر النسخة المعتمدة في موعدها"));
        if (draft.breaking) context.breakingCountToday = (context.breakingCountToday ?? 0) + 1;
      } else {
        await db.batch([
          lockStory(story),
          db.update(stories).set({ status: "review", scheduledAt: null, updatedAt: now, version: story.version + 1 }).where(eq(stories.id, story.id)),
          auditQuery("النظام", "schedule:blocked", story.id, report.audit.blockingRuleIds.join("، "), { before: story, after: { status: "review", scheduledAt: null } }),
        ]);
      }
    } catch (error) {
      // عامل آخر سبقنا أو تغيّرت النسخة: لا ننشر ولا نكتب سجل نجاح مضللًا.
      let cause: unknown = error;
      let conflict = error instanceof StoryWriteError;
      while (cause && typeof cause === "object") {
        if ("code" in cause && cause.code === "40001") conflict = true;
        cause = "cause" in cause ? cause.cause : null;
      }
      if (!conflict) throw error;
      if (error instanceof StoryWriteError) {
        // تعارض الأصل دائم لهذه النسخة؛ أخرجها من الطابور لئلا تحجب المواد التالية.
        try {
          await db.batch([lockStory(story), db.update(stories).set({ status: "review", scheduledAt: null, version: story.version + 1, updatedAt: now }).where(eq(stories.id, story.id)), auditQuery("النظام", "schedule:conflict", story.id, error.message, { before: story, after: { status: "review", scheduledAt: null } })]);
        } catch (transitionError) {
          let cause: unknown = transitionError;
          for (let depth = 0; depth < 5 && cause && typeof cause === "object"; depth++) {
            if ("code" in cause && cause.code === "40001") { cause = null; break; }
            cause = "cause" in cause ? cause.cause : undefined;
          }
          if (cause !== null) throw transitionError;
        }
      }
    }
  }
  } finally {
    // أي انتقال هنا (نشر أو إعادة للاعتماد) يغيّر العدّادات — بعد الالتزام لا قبله.
    invalidateStatusCounts();
  }
  return promoted;
}

export async function listAudit(limit = 100) {
  const db = requireDb();
  return db.select({ id: auditLog.id, at: auditLog.at, actor: auditLog.actor, action: auditLog.action, storyId: auditLog.storyId, detail: auditLog.detail }).from(auditLog).orderBy(desc(auditLog.at), desc(auditLog.id)).limit(limit);
}

/** يبني حقل media لمسودة الحارس من صورة المادة إن كانت من المكتبة. */
export async function guardMediaFor(imageUrl: string | null | undefined) {
  if (!imageUrl) return undefined;
  const unknown = [{ url: imageUrl, rightsCleared: false, flags: [] as string[] }];
  if (!imageUrl.startsWith("/uploads/")) return unknown;
  const asset = await findMediaByUrl(imageUrl);
  if (!asset) return unknown;
  return [
    {
      id: asset.id,
      url: asset.url,
      rightsCleared: asset.rightsCleared === 1,
      flags: asset.flags ? asset.flags.split(",").filter(Boolean) : [],
    },
  ];
}

/** إظهار/إخفاء سلسلة متقاعدة من فهارس الاستكشاف — صفحتها تبقى حية دائمًا. */
export async function setSeriesHidden(slug: string, hidden: boolean, actor: string) {
  const db = requireDb();
  const { series } = await import("@/db/schema");
  await db.update(series).set({ hidden: hidden ? 1 : 0 }).where(eq(series.slug, slug));
  await audit(actor, hidden ? "series:hide" : "series:show", undefined, slug);
}

export async function listSeriesRows() {
  const db = requireDb();
  const { series } = await import("@/db/schema");
  return db.select().from(series);
}

/* ============ استعلامات رشيقة — للقوائم بلا متون (الأداء مع آلاف المواد) ============ */

const LITE_COLUMNS = {
  id: stories.id,
  slug: stories.slug,
  section: stories.section,
  title: stories.title,
  status: stories.status,
  seriesSlug: stories.seriesSlug,
  authorName: stories.authorName,
  publishedAt: stories.publishedAt,
  updatedAt: stories.updatedAt,
  scheduledAt: stories.scheduledAt,
  format: stories.format,
};

export type StoryLite = {
  [K in keyof typeof LITE_COLUMNS]: (typeof stories.$inferSelect)[K];
};

export const recencyOrder = desc(sql`coalesce(${stories.updatedAt}, ${stories.publishedAt})`);

/**
 * عدّادات الحالات: layout والصفحة يتشاركان النتيجة داخل الطلب عبر cache()،
 * وبين الطلبات تُحفظ 20 ثانية داخل العملية (لا بيانات مستخدم فيها) وتُبطل عند أي تغيير حالة.
 */
export const statusCounts = cache((): Promise<Record<string, number>> => cachedStatusCounts(async () => {
  const db = requireDb();
  const rows = await db
    .select({ status: stories.status, count: sql<number>`count(*)` })
    .from(stories)
    .groupBy(stories.status);
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
}));

/** مرشّحات قائمة المواد فوق الحالة: بحث في المحتوى وسلسلة بعينها. */
export interface StoryFilters {
  q?: string;
  seriesSlug?: string;
}

/** يحوّل نص البحث إلى نمط ILIKE آمن — يهرب محارف النمط ويحصر الطول. */
function titlePattern(q: string): string {
  const cleaned = q.trim().slice(0, 80).replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${cleaned}%`;
}

/** شرط قائمة المواد (الحالة + البحث + السلسلة) — مشترك مع واجهات القراءة للتطبيق. */
export function pageWhere(status: StoryStatus | undefined, filters: StoryFilters): SQL {
  const clauses: SQL[] = [status ? eq(stories.status, status) : ne(stories.status, "archived")];
  if (filters.q?.trim()) clauses.push(storySearchWhere(stories, filters.q));
  if (filters.seriesSlug) clauses.push(eq(stories.seriesSlug, filters.seriesSlug));
  return and(...clauses)!;
}

/** ترتيب موحّد لقائمة الويب والتطبيق؛ الأقرب للبحث ثم الأحدث. */
export function storyListOrder(filters: StoryFilters): SQL[] {
  return [...(filters.q?.trim() ? [storySearchRank(stories, filters.q)] : []), recencyOrder, desc(stories.id)];
}

/** صفحة واحدة من المواد — أعمدة خفيفة فقط. */
export async function listPage(
  status: StoryStatus | undefined,
  page: number,
  perPage: number,
  filters: StoryFilters = {},
): Promise<StoryLite[]> {
  const db = requireDb();
  return db
    .select(LITE_COLUMNS)
    .from(stories)
    .where(pageWhere(status, filters))
    .orderBy(...storyListOrder(filters))
    .limit(perPage)
    .offset(Math.max(0, page - 1) * perPage);
}

/** متن المواد المعروضة فقط لفحص الحارس على الخادم، في رحلة جلب واحدة مع القائمة. */
export async function listPageForReview(
  status: StoryStatus | undefined,
  page: number,
  perPage: number,
  filters: StoryFilters = {},
): Promise<Array<StoryLite & { body: string; authorId: string | null; assignedTo: string | null }>> {
  const db = requireDb();
  return db.select({ ...LITE_COLUMNS, body: stories.body, authorId: stories.authorId, assignedTo: stories.assignedTo }).from(stories)
    .where(pageWhere(status, filters)).orderBy(...storyListOrder(filters))
    .limit(perPage).offset(Math.max(0, page - 1) * perPage);
}

/** عدد المواد المطابقة للمرشّحات نفسها — لترقيم صحيح عند البحث أو تصفية السلسلة. */
export async function countPage(
  status: StoryStatus | undefined,
  filters: StoryFilters = {},
): Promise<number> {
  const db = requireDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stories)
    .where(pageWhere(status, filters));
  return Number(row?.count ?? 0);
}

/** يوم الرياض لطابع منشور: القاعدة تحوّل النص إلى لحظة ثم إلى توقيت الرياض فيصح المفتاح مهما كانت صيغة الإزاحة. */
const riyadhPublishedDay = sql<string>`substr((${stories.publishedAt}::timestamptz at time zone 'Asia/Riyadh')::text, 1, 10)`;

/**
 * مرشّح زمني على published_at النصي: مقارنة نصية واسعة (بيوم) تُبقي الفهرس مستخدمًا،
 * ثم مقارنة اللحظات تُطبّق الحد الدقيق — تصمد أمام الصفوف القليلة المخزّنة بإزاحة +03:00 بدل Z.
 */
function publishedSince(startIso: string) {
  const coarse = new Date(Date.parse(startIso) - 86_400_000).toISOString();
  return sql`${stories.publishedAt} >= ${coarse} and ${stories.publishedAt}::timestamptz >= ${startIso}::timestamptz`;
}

/** المنشور يوميًا لآخر N يومًا بتوقيت الرياض — للمنحنى الصغير في نظرة اليوم؛ الأيام الخالية صفر. */
export async function publishedPerDay(days = 14, now: Date = new Date()): Promise<Array<{ day: string; count: number }>> {
  const db = requireDb();
  const keys = riyadhDayKeys(days, now);
  const start = riyadhDayBounds(new Date(now.getTime() - (days - 1) * 86_400_000)).startIso;
  const rows = await db
    .select({ day: riyadhPublishedDay, count: sql<number>`count(*)` })
    .from(stories)
    .where(and(eq(stories.status, "published"), publishedSince(start)))
    .groupBy(riyadhPublishedDay);
  const byDay = new Map(rows.map((row) => [row.day, Number(row.count)]));
  return keys.map((day) => ({ day, count: byDay.get(day) ?? 0 }));
}

/** أحدث مواد حالة معينة — للنظرة والجدولة، خفيفة. */
export async function listLatestByStatus(status: StoryStatus, limit: number): Promise<StoryLite[]> {
  const db = requireDb();
  return db
    .select(LITE_COLUMNS)
    .from(stories)
    .where(eq(stories.status, status))
    .orderBy(recencyOrder, desc(stories.id))
    .limit(limit);
}

/** أحدث مواد شكل تحريري معين — لقوائم الأقسام المتخصصة مثل جاك العلم. */
export async function listLatestByFormat(format: string, limit: number): Promise<StoryLite[]> {
  const db = requireDb();
  return db
    .select(LITE_COLUMNS)
    .from(stories)
    .where(and(eq(stories.format, format), ne(stories.status, "archived")))
    .orderBy(recencyOrder, desc(stories.id))
    .limit(limit);
}

/** المتون لمعرفات محددة — لفحص الحارس على المعروض فقط. */
export async function bodiesFor(ids: string[]): Promise<Map<string, { title: string; body: string }>> {
  if (ids.length === 0) return new Map();
  const db = requireDb();
  const rows = await db
    .select({ id: stories.id, title: stories.title, body: stories.body })
    .from(stories)
    .where(inArray(stories.id, ids));
  return new Map(rows.map((row) => [row.id, { title: row.title, body: row.body }]));
}

/** عدد المنشور اليوم بتوقيت الرياض — تجميعي. */
export async function publishedTodayCount(now: Date = new Date()): Promise<number> {
  const db = requireDb();
  const { startIso, endIso } = riyadhDayBounds(now);
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stories)
    .where(and(eq(stories.status, "published"), publishedSince(startIso), sql`${stories.publishedAt}::timestamptz < ${endIso}::timestamptz`));
  return Number(row?.count ?? 0);
}

/** توزيع السلاسل للمواد المنشورة فقط: [seriesSlug, total, أسبوعي]. */
export async function seriesDistribution(): Promise<
  Array<{ seriesSlug: string; total: number; week: number }>
> {
  const db = requireDb();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const rows = await db
    .select({
      seriesSlug: stories.seriesSlug,
      total: sql<number>`count(*)`,
      week: sql<number>`count(*) filter (where ${stories.publishedAt}::timestamptz >= ${weekAgo}::timestamptz)`,
    })
    .from(stories)
    .where(and(eq(stories.status, "published"), sql`${stories.seriesSlug} is not null`))
    .groupBy(stories.seriesSlug);
  return rows
    .filter((row) => row.seriesSlug)
    .map((row) => ({ seriesSlug: row.seriesSlug!, total: Number(row.total), week: Number(row.week) }));
}

/** توزيع أشكال المحتوى للمواد المنشورة: [format, count]. */
export async function formatDistribution(): Promise<Array<{ format: string; count: number }>> {
  const db = requireDb();
  const rows = await db
    .select({
      format: stories.format,
      count: sql<number>`count(*)`,
    })
    .from(stories)
    .where(eq(stories.status, "published"))
    .groupBy(stories.format)
    .orderBy(desc(sql`count(*)`));
  return rows.map((row) => ({
    format: row.format || "news",
    count: Number(row.count),
  }));
}

/** أكثر الكُتّاب إنتاجًا للمواد المنشورة. */
export async function topAuthors(limit = 6): Promise<Array<{ authorName: string; count: number }>> {
  const db = requireDb();
  const rows = await db
    .select({
      authorName: stories.authorName,
      count: sql<number>`count(*)`,
    })
    .from(stories)
    .where(and(eq(stories.status, "published"), ne(stories.authorName, "")))
    .groupBy(stories.authorName)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows.map((row) => ({
    authorName: row.authorName,
    count: Number(row.count),
  }));
}

/** توزيع أزمنة القراءة للمواد المنشورة: سريعة (< 3 د)، متوسطة (3-5 د)، مطولة (> 5 د). */
export async function readingTimeDistribution(): Promise<{ quick: number; medium: number; long: number }> {
  const db = requireDb();
  const [row] = await db
    .select({
      quick: sql<number>`count(*) filter (where ${stories.readingMinutes} < 3)`,
      medium: sql<number>`count(*) filter (where ${stories.readingMinutes} >= 3 and ${stories.readingMinutes} <= 5)`,
      long: sql<number>`count(*) filter (where ${stories.readingMinutes} > 5)`,
    })
    .from(stories)
    .where(eq(stories.status, "published"));
  return {
    quick: Number(row?.quick ?? 0),
    medium: Number(row?.medium ?? 0),
    long: Number(row?.long ?? 0),
  };
}
