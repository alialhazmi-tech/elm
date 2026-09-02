/** طبقة بيانات «تحرير العلم»: استعلامات اللوحة، حفظ المسودات، سير الاعتماد، وسجل التدقيق. */

import { and, desc, eq, ilike, inArray, ne, sql, type SQL } from "drizzle-orm";

import { auditLog, stories, users } from "@/db/schema";
import { stripHtmlToText } from "@/lib/content/html";
import { getDb } from "@/lib/db";

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

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("قاعدة البيانات غير مهيأة — «تحرير العلم» يتطلب DATABASE_URL.");
  return db;
}

export async function findUser(username: string): Promise<UserRow | null> {
  const db = requireDb();
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0] ?? null;
}

export async function audit(actor: string, action: string, storyId?: string, detail = "") {
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

/** كل المواد لكل الحالات — للوحة فقط، الموقع العام يمر عبر المزود المفلتر. */
export async function listForDashboard(): Promise<StoryRow[]> {
  const db = requireDb();
  return db
    .select()
    .from(stories)
    .orderBy(desc(sql`coalesce(${stories.updatedAt}, ${stories.publishedAt})`));
}

export async function getStory(id: string): Promise<StoryRow | null> {
  const db = requireDb();
  const rows = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  return rows[0] ?? null;
}

export interface DraftInput {
  id: string;
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
  /** undefined = لا تغيير — التثبيت والعاجل من صلاحية المعتمدين فقط. */
  pinned?: boolean;
  breakingUntil?: string | null;
}

export async function saveDraft(input: DraftInput, actor: string): Promise<void> {
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
  };
  // دقائق القراءة من نص المتن الفعلي — 200 كلمة/دقيقة بين 1 و15.
  const words = stripHtmlToText(input.body).split(/\s+/u).filter(Boolean).length;
  const readingMinutes = Math.min(15, Math.max(1, Math.round(words / 200) || 1));

  await db
    .insert(stories)
    .values({
      id: input.id,
      slug: input.slug,
      section: input.section,
      title: input.title,
      excerpt: input.excerpt,
      body: input.body,
      seriesSlug: input.seriesSlug,
      image: input.image,
      status: "draft",
      authorName: actor,
      updatedAt: now,
      readingMinutes,
      ...privileged,
      ...seo,
    })
    .onConflictDoUpdate({
      target: stories.id,
      set: {
        slug: input.slug,
        section: input.section,
        title: input.title,
        excerpt: input.excerpt,
        body: input.body,
        seriesSlug: input.seriesSlug,
        image: input.image,
        updatedAt: now,
        readingMinutes,
        ...privileged,
        ...seo,
      },
    });
}

export async function setStatus(
  id: string,
  status: StoryStatus,
  actor: string,
  detail = "",
): Promise<void> {
  const db = requireDb();
  const now = new Date().toISOString();

  await db
    .update(stories)
    .set(
      status === "published"
        ? { status, updatedAt: now, publishedAt: now }
        : { status, updatedAt: now },
    )
    .where(eq(stories.id, id));

  await audit(actor, `status:${status}`, id, detail);
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
      returning id, title
    ), deleted_slides as (
      delete from story_slides where story_id in (select id from deleted_story)
    ), deleted_source as (
      delete from jak_sources where story_id in (select id from deleted_story)
    )
    insert into audit_log (id, at, actor, action, story_id, detail)
    select ${crypto.randomUUID()}, ${new Date().toISOString()}, ${actor}, 'draft:delete', id, title
    from deleted_story
    returning story_id as "storyId"
  `);
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
  await db
    .update(stories)
    .set({
      status: "archived",
      updatedAt: now,
      pinned: 0,
      breakingUntil: null,
    })
    .where(eq(stories.id, id));
  await audit(actor, ARCHIVE_ACTION, id, trimmed);
  return "archived";
}

/** إعادة المادة المؤرشفة إلى مسودة — لا تظهر على الموقع حتى يُعاد نشرها. */
export async function restoreArchived(id: string, actor: string): Promise<RestoreResult> {
  const db = requireDb();
  const story = (await db.select().from(stories).where(eq(stories.id, id)).limit(1))[0];
  if (!story) return "not-found";
  if (story.status !== "archived") return "not-archived";

  const now = new Date().toISOString();
  await db
    .update(stories)
    .set({ status: "draft", updatedAt: now })
    .where(eq(stories.id, id));
  await audit(actor, RESTORE_ACTION, id, "استعادة من الأرشيف إلى مسودة");
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
import { runPolicyGuard } from "@/lib/policy";

export type MediaRow = typeof media.$inferSelect;
export type ProposalRow = typeof seriesProposals.$inferSelect;

export async function listMedia(): Promise<MediaRow[]> {
  const db = requireDb();
  return db.select().from(media).orderBy(desc(media.createdAt));
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

export async function scheduleStory(id: string, scheduledAt: string, actor: string) {
  const db = requireDb();
  await db
    .update(stories)
    .set({ status: "scheduled", scheduledAt, updatedAt: new Date().toISOString() })
    .where(eq(stories.id, id));
  await audit(actor, "status:scheduled", id, `الموعد ${scheduledAt}`);
}

/**
 * ترقية المواد المجدولة التي حان موعدها — تمر على الحارس لحظة الموعد:
 * السليمة تُنشر، والمخالفة تعود للاعتماد ويُدوَّن المنع. تُستدعى من
 * تحميل اللوحة ومن /api/tahrir/tick (لمراقب خارجي).
 */
export interface PromotedStory {
  id: string;
  section: string;
  slug: string;
}

/** يعيد المواد التي نُشرت فعلًا — ليبطل مستدعيها (Route Handler) كاش صفحاتها العامة. */
export async function promoteDueScheduled(): Promise<PromotedStory[]> {
  const db = requireDb();
  const now = new Date().toISOString();
  const due = await db
    .select()
    .from(stories)
    .where(eq(stories.status, "scheduled"));

  const promoted: PromotedStory[] = [];
  for (const story of due) {
    if (!story.scheduledAt || story.scheduledAt > now) continue;
    const report = runPolicyGuard({
      id: story.id,
      title: story.title,
      body: stripHtmlToText(story.body),
      surface: story.format === "jakalelm" ? ("design" as const) : undefined,
    });
    if (report.canRequestApproval) {
      await db
        .update(stories)
        .set({ status: "published", publishedAt: now, updatedAt: now })
        .where(eq(stories.id, story.id));
      await audit("النظام", "publish:scheduled", story.id, "نشر مجدول — مرّ على الحارس لحظة الموعد");
      promoted.push({ id: story.id, section: story.section, slug: story.slug });
    } else {
      await db
        .update(stories)
        .set({ status: "review", scheduledAt: null, updatedAt: now })
        .where(eq(stories.id, story.id));
      await audit(
        "النظام",
        "schedule:blocked",
        story.id,
        `أوقف الحارس النشر المجدول: ${report.audit.blockingRuleIds.join("، ")}`,
      );
    }
  }
  return promoted;
}

export async function listAudit(limit = 100) {
  const db = requireDb();
  return db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(limit);
}

/** يبني حقل media لمسودة الحارس من صورة المادة إن كانت من المكتبة. */
export async function guardMediaFor(imageUrl: string | null | undefined) {
  if (!imageUrl?.startsWith("/uploads/")) return undefined;
  const asset = await findMediaByUrl(imageUrl);
  if (!asset) return undefined;
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

const recencyOrder = desc(sql`coalesce(${stories.updatedAt}, ${stories.publishedAt})`);

/** عدّادات الحالات بضربة SQL واحدة — بدل جلب كل الصفوف للعد. */
export async function statusCounts(): Promise<Record<string, number>> {
  const db = requireDb();
  const rows = await db
    .select({ status: stories.status, count: sql<number>`count(*)` })
    .from(stories)
    .groupBy(stories.status);
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
}

/** مرشّحات قائمة المواد فوق الحالة: بحث في العنوان وسلسلة بعينها. */
export interface StoryFilters {
  q?: string;
  seriesSlug?: string;
}

/** يحوّل نص البحث إلى نمط ILIKE آمن — يهرب محارف النمط ويحصر الطول. */
function titlePattern(q: string): string {
  const cleaned = q.trim().slice(0, 80).replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${cleaned}%`;
}

function pageWhere(status: StoryStatus | undefined, filters: StoryFilters): SQL {
  const clauses: SQL[] = [status ? eq(stories.status, status) : ne(stories.status, "archived")];
  if (filters.q?.trim()) clauses.push(ilike(stories.title, titlePattern(filters.q)));
  if (filters.seriesSlug) clauses.push(eq(stories.seriesSlug, filters.seriesSlug));
  return and(...clauses)!;
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
    .orderBy(recencyOrder)
    .limit(perPage)
    .offset(Math.max(0, page - 1) * perPage);
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

/** المنشور يوميًا لآخر N يومًا (بتوقيت UTC للتاريخ المخزّن) — للمنحنى الصغير في نظرة اليوم؛ الأيام الخالية صفر. */
export async function publishedPerDay(days = 14): Promise<Array<{ day: string; count: number }>> {
  const db = requireDb();
  const start = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({
      day: sql<string>`substr(${stories.publishedAt}, 1, 10)`,
      count: sql<number>`count(*)`,
    })
    .from(stories)
    .where(and(eq(stories.status, "published"), gteText(stories.publishedAt, start)))
    .groupBy(sql`substr(${stories.publishedAt}, 1, 10)`);
  const bySlug = new Map(rows.map((row) => [row.day, Number(row.count)]));
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(Date.now() - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10);
    return { day, count: bySlug.get(day) ?? 0 };
  });
}

/** أحدث مواد حالة معينة — للنظرة والجدولة، خفيفة. */
export async function listLatestByStatus(status: StoryStatus, limit: number): Promise<StoryLite[]> {
  const db = requireDb();
  return db
    .select(LITE_COLUMNS)
    .from(stories)
    .where(eq(stories.status, status))
    .orderBy(recencyOrder)
    .limit(limit);
}

/** أحدث مواد شكل تحريري معين — لقوائم الأقسام المتخصصة مثل جاك العلم. */
export async function listLatestByFormat(format: string, limit: number): Promise<StoryLite[]> {
  const db = requireDb();
  return db
    .select(LITE_COLUMNS)
    .from(stories)
    .where(and(eq(stories.format, format), ne(stories.status, "archived")))
    .orderBy(recencyOrder)
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

/** عدد المنشور اليوم — تجميعي. */
export async function publishedTodayCount(): Promise<number> {
  const db = requireDb();
  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stories)
    .where(and(eq(stories.status, "published"), gteText(stories.publishedAt, today)));
  return Number(row?.count ?? 0);
}

/** توزيع السلاسل تجميعيًا: [seriesSlug, total, أسبوعي]. */
export async function seriesDistribution(): Promise<
  Array<{ seriesSlug: string; total: number; week: number }>
> {
  const db = requireDb();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const rows = await db
    .select({
      seriesSlug: stories.seriesSlug,
      total: sql<number>`count(*)`,
      week: sql<number>`count(*) filter (where ${stories.publishedAt} >= ${weekAgo})`,
    })
    .from(stories)
    .groupBy(stories.seriesSlug);
  return rows
    .filter((row) => row.seriesSlug)
    .map((row) => ({ seriesSlug: row.seriesSlug!, total: Number(row.total), week: Number(row.week) }));
}

function gteText(column: typeof stories.publishedAt, value: string) {
  return sql`${column} >= ${value}`;
}
