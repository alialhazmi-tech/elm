/** طبقة بيانات «تحرير العلم»: استعلامات اللوحة، حفظ المسودات، سير الاعتماد، وسجل التدقيق. */

import { desc, eq, sql } from "drizzle-orm";

import { auditLog, stories, users } from "@/db/schema";
import { getDb } from "@/lib/db";

export type StoryRow = typeof stories.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type StoryStatus = "draft" | "review" | "published";

export const STATUS_LABELS: Record<StoryStatus, string> = {
  draft: "مسودة",
  review: "بانتظار الاعتماد",
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
}

export async function saveDraft(input: DraftInput, actor: string): Promise<void> {
  const db = requireDb();
  const now = new Date().toISOString();

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
      status: "draft",
      authorName: actor,
      updatedAt: now,
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
        updatedAt: now,
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
