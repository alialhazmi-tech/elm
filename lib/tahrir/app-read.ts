/**
 * واجهات القراءة للتطبيق الأصلي — نفس بيانات شاشات اللوحة وبنفس بواباتها، بلا منطق جديد في القاعدة.
 * كل دالة هنا تقابل شاشة في `app/tahrir/(app)/*` وتعيد JSON قابلًا للتسلسل؛ المسارات في
 * `app/api/tahrir/*` رقيقة: بوابة الصلاحية ثم استدعاء الدالة ثم `Cache-Control: private, no-store`.
 */

import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import { stories, storyVersions } from "@/db/schema";
import { loadAiSettings, type AiSettingsData } from "@/lib/ai/settings";
import { stripHtmlToText } from "@/lib/content/html";
import { SECTION_NAMES } from "@/lib/content/seed";
import { ALL_SERIES } from "@/lib/content/series";
import { loadEditorialTaxonomy, loadTaxonomyVisibility } from "@/lib/content/taxonomy-settings";
import { absoluteMedia } from "@/lib/mobile/origin";
import { runConfiguredPolicyGuard, type GuardControls } from "@/lib/policy";

import { canEditStory, type Actor } from "./access";
import { listAuditEntries, type AuditEntry } from "./audit-data";
import {
  ACTIVE_STATUSES,
  countMedia,
  countPage,
  formatDistribution,
  getStory,
  latestArchiveEvents,
  listMediaPage,
  listProposals,
  listSeriesRows,
  nextScheduledAt,
  pageWhere,
  publishedPerDay,
  publishedTodayCount,
  readingTimeDistribution,
  recencyOrder,
  seriesDistribution,
  STATUS_LABELS,
  statusCounts,
  topAuthors,
  type ArchiveEvent,
  type MediaFilter,
  type StoryFilters,
  type StoryStatus,
} from "./service";
import { riyadhDayBounds } from "./time";
import { workflowDb } from "./workflow";
import { StoryWriteError } from "./write-policy";

/* ============ صف المادة الموحّد ============ */

export type GuardTone = "ok" | "warn" | "block";

export interface StoryListRow {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  section: string;
  sectionName: string;
  seriesSlug: string | null;
  series: { name: string; color: string } | null;
  authorName: string;
  authorId: string | null;
  assignedTo: string | null;
  format: string;
  isJak: boolean;
  image: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  revisionOf: string | null;
  dueAt: string | null;
  returnedAt: string | null;
  /** نتيجة الحارس على العنوان والمتن حيث تحسبها الشاشة المقابلة؛ null حيث لا تُحسب. */
  guard: { tone: GuardTone; label: string } | null;
  publicHref: string | null;
  canEdit: boolean;
  archive: ArchiveEvent | null;
}

const ROW_COLUMNS = {
  id: stories.id,
  slug: stories.slug,
  section: stories.section,
  title: stories.title,
  status: stories.status,
  seriesSlug: stories.seriesSlug,
  authorName: stories.authorName,
  authorId: stories.authorId,
  assignedTo: stories.assignedTo,
  publishedAt: stories.publishedAt,
  updatedAt: stories.updatedAt,
  scheduledAt: stories.scheduledAt,
  format: stories.format,
  image: stories.image,
  revisionOf: stories.revisionOf,
  dueAt: stories.dueAt,
  returnedAt: stories.returnedAt,
};

type RawRow = { [K in keyof typeof ROW_COLUMNS]: (typeof stories.$inferSelect)[K] } & { body?: string };

const seriesBySlug = new Map<string, (typeof ALL_SERIES)[number]>(ALL_SERIES.map((series) => [series.slug, series]));

export const FORMAT_LABELS: Record<string, string> = {
  news: "أخبار",
  infographics: "إنفوجرافيك",
  videos: "فيديو",
  reports: "تقارير",
  podcasts: "بودكاست",
  jakalelm: "جاك العلم",
};

function guardFor(title: string, body: string, surface: "design" | undefined, controls: GuardControls): { tone: GuardTone; label: string } {
  const report = runConfiguredPolicyGuard({ title, body: stripHtmlToText(body), surface }, controls);
  if (report.counts.blocking > 0) return { tone: "block", label: `${report.counts.blocking} قاطع` };
  if (report.counts.warning > 0) return { tone: "warn", label: `${report.counts.warning} تحذير` };
  return { tone: "ok", label: "سليم" };
}

function toRow(actor: Actor, row: RawRow, options: { controls?: GuardControls; archive?: ArchiveEvent } = {}): StoryListRow {
  const series = row.seriesSlug ? seriesBySlug.get(row.seriesSlug) : undefined;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status as StoryStatus] ?? row.status,
    section: row.section,
    sectionName: SECTION_NAMES[row.section] ?? row.section,
    seriesSlug: row.seriesSlug ?? null,
    series: series ? { name: series.name, color: series.color } : null,
    authorName: row.authorName,
    authorId: row.authorId ?? null,
    assignedTo: row.assignedTo ?? null,
    format: row.format || "news",
    isJak: row.format === "jakalelm",
    image: row.image ?? null,
    updatedAt: row.updatedAt ?? null,
    publishedAt: row.publishedAt ?? null,
    scheduledAt: row.scheduledAt ?? null,
    revisionOf: row.revisionOf ?? null,
    dueAt: row.dueAt ?? null,
    returnedAt: row.returnedAt ?? null,
    guard: options.controls && row.body !== undefined
      ? guardFor(row.title, row.body, row.format === "jakalelm" ? "design" : undefined, options.controls)
      : null,
    publicHref: row.status === "published" ? `/${row.section}/${row.id}/${row.slug}` : null,
    canEdit: canEditStory(actor, { authorId: row.authorId, assignedTo: row.assignedTo }),
    archive: options.archive ?? null,
  };
}

async function latestRows(status: StoryStatus, limit: number): Promise<RawRow[]> {
  return workflowDb().select(ROW_COLUMNS).from(stories).where(eq(stories.status, status)).orderBy(recencyOrder, desc(stories.id)).limit(limit);
}

async function pageRows(status: StoryStatus | undefined, page: number, perPage: number, filters: StoryFilters): Promise<RawRow[]> {
  return workflowDb()
    .select({ ...ROW_COLUMNS, body: stories.body })
    .from(stories)
    .where(pageWhere(status, filters))
    .orderBy(recencyOrder, desc(stories.id))
    .limit(perPage)
    .offset(Math.max(0, page - 1) * perPage);
}

/* ============ 8. الهوية ============ */

export function appMe(actor: Actor, settings: AiSettingsData) {
  return {
    actor: {
      userId: actor.userId,
      username: actor.username,
      displayName: actor.displayName,
      avatarUrl: actor.avatarUrl,
      role: actor.role,
      roleLabel: actor.roleLabel,
      permissions: [...actor.permissions].sort(),
      mustChangePassword: actor.mustChangePassword,
      mfaEnabled: actor.mfaEnabled,
      mfaRequired: actor.mfaRequired,
    },
    governance: settings.governance,
  };
}

/* ============ 9. نظرة اليوم ============ */

export async function appOverview(actor: Actor) {
  const today = riyadhDayBounds();
  const [settings, counts, todayCount, perDay, review, latestPublished, latestDraft, scheduled, distribution, media, nextAt] =
    await Promise.all([
      loadAiSettings(),
      statusCounts().catch(() => ({}) as Record<string, number>),
      publishedTodayCount().catch(() => 0),
      publishedPerDay(14).catch(() => []),
      workflowDb()
        .select({ ...ROW_COLUMNS, body: stories.body })
        .from(stories)
        .where(pageWhere("review", {}))
        .orderBy(recencyOrder, desc(stories.id))
        .limit(6)
        .catch(() => [] as RawRow[]),
      latestRows("published", 12).catch(() => []),
      latestRows("draft", 5).catch(() => []),
      latestRows("scheduled", 40).catch(() => []),
      seriesDistribution().catch(() => []),
      countMedia().catch(() => ({ all: 0, ok: 0, pending: 0 })),
      nextScheduledAt().catch(() => null),
    ]);
  return {
    today: { dayKey: today.dayKey, startIso: today.startIso, endIso: today.endIso },
    counts,
    todayCount,
    perDay,
    review: review.map((row) => toRow(actor, row, { controls: settings.governance })),
    latestPublished: latestPublished.map((row) => toRow(actor, row)),
    latestDraft: latestDraft.map((row) => toRow(actor, row)),
    scheduled: scheduled.map((row) => toRow(actor, row)),
    seriesDistribution: distribution,
    media,
    nextScheduledAt: nextAt,
  };
}

/* ============ 10. قائمة المواد ============ */

export const STORY_LIST_PER_PAGE = 30;
const VALID_STATUSES = new Set<string>([...ACTIVE_STATUSES, "archived"]);

export async function appStoryList(actor: Actor, params: { status?: string | null; p?: string | null; q?: string | null; series?: string | null }) {
  const settingsPromise = loadAiSettings();
  const status = VALID_STATUSES.has(params.status ?? "") ? (params.status as StoryStatus) : undefined;
  const requestedPage = Number(params.p);
  const requested = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const q = (params.q ?? "").trim().slice(0, 80);
  const seriesSlug = params.series && seriesBySlug.has(params.series) ? params.series : "";
  const filters: StoryFilters = { q: q || undefined, seriesSlug: seriesSlug || undefined };
  const hasFilters = Boolean(filters.q || filters.seriesSlug);

  const [settings, counts, requestedRows, filteredCount] = await Promise.all([
    settingsPromise,
    statusCounts(),
    pageRows(status, requested, STORY_LIST_PER_PAGE, filters),
    hasFilters ? countPage(status, filters) : Promise.resolve(null),
  ]);
  const activeTotal = Object.entries(counts).reduce((sum, [key, count]) => (key === "archived" ? sum : sum + count), 0);
  const total = filteredCount ?? (status ? (counts[status] ?? 0) : activeTotal);
  const totalPages = Math.max(1, Math.ceil(total / STORY_LIST_PER_PAGE));
  // رقم صفحة خارج المدى يُقصّ إلى آخر صفحة بدل قائمة فارغة — كما في شاشة المواد.
  const page = Math.min(requested, totalPages);
  const rows = page === requested ? requestedRows : await pageRows(status, page, STORY_LIST_PER_PAGE, filters);
  const archiveEvents = status === "archived" ? await latestArchiveEvents(rows.map((row) => row.id)) : new Map<string, ArchiveEvent>();

  return {
    rows: rows.map((row) => toRow(actor, row, { controls: settings.governance, archive: archiveEvents.get(row.id) })),
    total,
    page,
    perPage: STORY_LIST_PER_PAGE,
    totalPages,
    counts: { ...counts, active: activeTotal },
    filters: { status: status ?? null, q, series: seriesSlug || null },
  };
}

/* ============ 11. مادة واحدة ============ */

export async function appStoryDetail(actor: Actor, id: string) {
  const story = await getStory(id);
  if (!story) throw new StoryWriteError("المادة غير موجودة.", 404);
  if (!canEditStory(actor, story)) throw new StoryWriteError("لا تملك صلاحية قراءة هذه المادة.", 403);
  const archiveEvent = story.status === "archived" ? ((await latestArchiveEvents([story.id])).get(story.id) ?? null) : null;
  return {
    story: {
      id: story.id,
      version: story.version,
      revisionOf: story.revisionOf,
      status: story.status,
      title: story.title,
      excerpt: story.excerpt,
      body: story.body,
      section: story.section,
      slug: story.slug,
      seriesSlug: story.seriesSlug,
      image: story.image,
      format: story.format || "news",
      pinned: story.pinned === 1,
      breakingUntil: story.breakingUntil,
      publishedAt: story.publishedAt,
      updatedAt: story.updatedAt,
      scheduledAt: story.scheduledAt,
      seoTitle: story.seoTitle ?? "",
      seoDescription: story.seoDescription ?? "",
      keywords: Array.isArray(story.keywords) ? (story.keywords as string[]) : [],
      videoUrl: story.videoUrl ?? null,
      authorName: story.authorName,
      authorId: story.authorId,
      assignedTo: story.assignedTo,
      dueAt: story.dueAt,
      returnedAt: story.returnedAt,
    },
    archiveEvent,
    capabilities: {
      canEdit: true,
      canSubmit: actor.can("story.submit"),
      // الاعتماد من المحرر يمر ببوابة النشر نفسها (`story.publish`) كما في شاشة المحرر.
      canApprove: actor.can("story.publish"),
      canSchedule: actor.can("story.schedule"),
      canArchive: actor.can("story.archive"),
      canRestore: actor.can("story.restore"),
      canDelete: story.status === "draft",
      canAssign: actor.can("story.edit.any"),
    },
    historyHref: `/tahrir/history/${story.revisionOf ?? story.id}`,
  };
}

/* ============ 12. مهامي ============ */

export const TASKS_PER_PAGE = 30;
const TASK_FILTERS = new Set(["all", "assigned", "returned", "own"]);
const TASK_STATUS_LABELS: Record<string, string> = { draft: "مسودة", review: "بانتظار الاعتماد", scheduled: "مجدولة" };

export async function appTasks(actor: Actor, params: { filter?: string | null; page?: string | null }) {
  const filter = TASK_FILTERS.has(params.filter ?? "") ? params.filter! : "all";
  const page = Math.min(1000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const mine = or(eq(stories.authorId, actor.userId), eq(stories.assignedTo, actor.userId));
  const rows = await workflowDb()
    .select({
      id: stories.id,
      title: stories.title,
      status: stories.status,
      assignedTo: stories.assignedTo,
      authorId: stories.authorId,
      dueAt: stories.dueAt,
      returnedAt: stories.returnedAt,
      revisionOf: stories.revisionOf,
      overdue: sql<boolean>`coalesce(${stories.dueAt}::timestamptz < now(), false)`,
    })
    .from(stories)
    .where(
      and(
        mine,
        inArray(stories.status, ["draft", "review", "scheduled"]),
        filter === "assigned"
          ? eq(stories.assignedTo, actor.userId)
          : filter === "own"
            ? eq(stories.authorId, actor.userId)
            : filter === "returned"
              ? isNotNull(stories.returnedAt)
              : undefined,
      ),
    )
    .orderBy(sql`${stories.dueAt} asc nulls last`, desc(stories.updatedAt), asc(stories.id))
    .limit(TASKS_PER_PAGE + 1)
    .offset((page - 1) * TASKS_PER_PAGE);
  return {
    filter,
    rows: rows.slice(0, TASKS_PER_PAGE).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      statusLabel: TASK_STATUS_LABELS[row.status] ?? row.status,
      assignedTo: row.assignedTo,
      authorId: row.authorId,
      dueAt: row.dueAt,
      returnedAt: row.returnedAt,
      revisionOf: row.revisionOf,
      overdue: Boolean(row.overdue),
      canEdit: canEditStory(actor, row),
    })),
    page,
    hasMore: rows.length > TASKS_PER_PAGE,
  };
}

/* ============ 13. التصنيفات ============ */

export async function appTaxonomy(actor: Actor) {
  const [taxonomy, visibility] = await Promise.all([
    loadEditorialTaxonomy(),
    actor.can("ai.settings") ? loadTaxonomyVisibility() : Promise.resolve(null),
  ]);
  return {
    sections: taxonomy.sections.map((item) => ({ slug: item.slug, name: item.name, shortName: item.shortName || item.name, color: item.color ?? null })),
    series: taxonomy.series.map((item) => ({ slug: item.slug, name: item.name, color: item.color, archived: Boolean(item.archived) })),
    formats: Object.entries(FORMAT_LABELS).map(([id, label]) => ({ id, label })),
    visibility,
  };
}

/* ============ 14. الوسائط ============ */

export const MEDIA_PER_PAGE = 24;
const MEDIA_FILTERS = new Set<string>(["all", "ok", "pending"]);

export async function appMedia(params: { f?: string | null; p?: string | null; q?: string | null }, origin: string) {
  const filter = (MEDIA_FILTERS.has(params.f ?? "") ? params.f : "all") as MediaFilter;
  const page = Math.max(1, Number(params.p) || 1);
  const q = (params.q ?? "").trim().slice(0, 80);
  const [rows, counts] = await Promise.all([
    listMediaPage(filter, page, MEDIA_PER_PAGE, q || undefined).catch(() => []),
    countMedia(q || undefined).catch(() => ({ all: 0, ok: 0, pending: 0 })),
  ]);
  return {
    filter,
    q,
    items: rows.map((row) => ({
      id: row.id,
      url: absoluteMedia(row.url, origin) ?? row.url,
      filename: row.filename,
      mime: row.mime,
      bytes: row.bytes,
      width: row.width,
      height: row.height,
      rightsCleared: row.rightsCleared === 1,
      flags: row.flags,
      uploadedBy: row.uploadedBy,
      createdAt: row.createdAt,
      aiGenerated: row.aiGenerated === 1,
    })),
    counts,
    page,
    perPage: MEDIA_PER_PAGE,
    total: counts[filter],
  };
}

/* ============ 15. سجل التدقيق ============ */

export const AUDIT_MAX = 200;

export async function appAudit(rawLimit: string | null): Promise<{ rows: AuditEntry[]; loadedAt: number }> {
  const parsed = Number.parseInt(rawLimit ?? "", 10);
  const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(AUDIT_MAX, parsed) : AUDIT_MAX;
  const result = await listAuditEntries();
  return { rows: result.rows.slice(0, limit), loadedAt: result.loadedAt };
}

/* ============ 16. الإحصاءات ============ */

export async function appStats() {
  const [counts, perDay, distribution, formats, authors, readingTime] = await Promise.all([
    statusCounts().catch(() => ({}) as Record<string, number>),
    publishedPerDay(14).catch(() => []),
    seriesDistribution().catch(() => []),
    formatDistribution().catch(() => []),
    topAuthors(6).catch(() => []),
    readingTimeDistribution().catch(() => ({ quick: 0, medium: 0, long: 0 })),
  ]);
  return {
    counts,
    perDay,
    seriesDistribution: distribution,
    formatDistribution: formats.map((row) => ({ ...row, label: FORMAT_LABELS[row.format] ?? row.format })),
    topAuthors: authors,
    readingTime,
  };
}

/* ============ 17. الجدولة ============ */

export async function appSchedule(actor: Actor) {
  const schedulerIntervalMs = Number(process.env.ALELM_SCHEDULER_INTERVAL_MS);
  const [scheduled, nextAt] = await Promise.all([latestRows("scheduled", 100).catch(() => []), nextScheduledAt().catch(() => null)]);
  return {
    scheduled: scheduled
      .map((row) => toRow(actor, row))
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "")),
    nextScheduledAt: nextAt,
    automatic: Number.isFinite(schedulerIntervalMs) && schedulerIntervalMs > 0,
  };
}

/* ============ 18. السلاسل ============ */

export async function appSeries() {
  const [distribution, proposals, rows] = await Promise.all([
    seriesDistribution().catch(() => []),
    listProposals().catch(() => []),
    listSeriesRows().catch(() => []),
  ]);
  return {
    distribution,
    proposals,
    rows: rows.map((row) => ({ slug: row.slug, name: row.name, description: row.description, color: row.color, hidden: row.hidden === 1 })),
  };
}

/* ============ 19. سجل النسخ ============ */

export async function appHistory(actor: Actor, id: string) {
  const story = await getStory(id);
  if (!story) throw new StoryWriteError("المادة غير موجودة.", 404);
  if (!canEditStory(actor, story)) throw new StoryWriteError("لا تملك صلاحية قراءة سجل هذه المادة.", 403);
  const versions = await workflowDb()
    .select({
      id: storyVersions.id,
      version: storyVersions.version,
      actor: storyVersions.actor,
      createdAt: storyVersions.createdAt,
      title: sql<string | null>`${storyVersions.data}->'story'->>'title'`,
    })
    .from(storyVersions)
    .where(eq(storyVersions.storyId, story.id))
    .orderBy(desc(storyVersions.version))
    .limit(100);
  return {
    versions,
    story: { id: story.id, status: story.status, version: story.version, revisionOf: story.revisionOf, format: story.format || "news" },
    canRestore: !story.revisionOf && ["published", "scheduled"].includes(story.status),
  };
}
