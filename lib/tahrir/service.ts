/** طبقة بيانات «تحرير العلم»: استعلامات اللوحة، حفظ المسودات، سير الاعتماد، وسجل التدقيق. */

import { desc, eq, sql } from "drizzle-orm";

import { auditLog, stories, users } from "@/db/schema";
import { stripHtmlToText } from "@/lib/content/html";
import { getDb } from "@/lib/db";

export type StoryRow = typeof stories.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type StoryStatus = "draft" | "review" | "scheduled" | "published";

export const STATUS_LABELS: Record<StoryStatus, string> = {
  draft: "مسودة",
  review: "بانتظار الاعتماد",
  scheduled: "مجدول",
  published: "منشور",
};

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

import { and, inArray } from "drizzle-orm";

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

/** صفحة واحدة من المواد — أعمدة خفيفة فقط. */
export async function listPage(
  status: StoryStatus | undefined,
  page: number,
  perPage: number,
): Promise<StoryLite[]> {
  const db = requireDb();
  const query = db
    .select(LITE_COLUMNS)
    .from(stories)
    .orderBy(recencyOrder)
    .limit(perPage)
    .offset(Math.max(0, page - 1) * perPage);
  return status ? query.where(eq(stories.status, status)) : query;
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
