import { and, desc, eq } from "drizzle-orm";
import { memberSavedStories, stories } from "@/db/schema";
import { getDb } from "@/lib/db";

export async function getSaved(memberId: string, storyId: string) {
  const db = getDb();
  if (!db) return false;
  const rows = await db.select().from(memberSavedStories).where(and(eq(memberSavedStories.memberId, memberId), eq(memberSavedStories.storyId, storyId))).limit(1);
  return rows.length > 0;
}
export async function setSaved(memberId: string, storyId: string, saved: boolean) {
  const db = getDb();
  if (!db) throw new Error("MEMBERSHIP_DATABASE_UNAVAILABLE");
  if (saved) await db.insert(memberSavedStories).values({ memberId, storyId, createdAt: new Date().toISOString() }).onConflictDoNothing();
  else await db.delete(memberSavedStories).where(and(eq(memberSavedStories.memberId, memberId), eq(memberSavedStories.storyId, storyId)));
  return saved;
}
export async function savedPage(memberId: string, offset = 0) {
  const db = getDb();
  if (!db) throw new Error("MEMBERSHIP_DATABASE_UNAVAILABLE");
  return db.select({ id: stories.id }).from(memberSavedStories)
    .innerJoin(stories, and(eq(stories.id, memberSavedStories.storyId), eq(stories.status, "published")))
    .where(eq(memberSavedStories.memberId, memberId))
    .orderBy(desc(memberSavedStories.createdAt), desc(memberSavedStories.storyId)).offset(offset).limit(101);
}
