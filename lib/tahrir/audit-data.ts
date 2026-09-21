import { desc, eq } from "drizzle-orm";
import { auditLog, stories, users } from "@/db/schema";
import { getDb } from "@/lib/db";
export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  storyId: string | null;
  detail: string;
  actorName: string | null;
  actorAvatarUrl: string | null;
  storyTitle: string | null;
};
/** Bounded private read; original actor/detail are preserved alongside current display labels. */
export async function listAuditEntries(): Promise<{
  rows: AuditEntry[];
  loadedAt: number;
}> {
  const db = getDb();
  if (!db) throw new Error("Audit database unavailable");
  const rows = await db
    .select({
      id: auditLog.id,
      at: auditLog.at,
      actor: auditLog.actor,
      action: auditLog.action,
      storyId: auditLog.storyId,
      detail: auditLog.detail,
      actorName: users.displayName,
      actorAvatarUrl: users.avatarUrl,
      storyTitle: stories.title,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.username, auditLog.actor))
    .leftJoin(stories, eq(stories.id, auditLog.storyId))
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(200);
  return { rows, loadedAt: Date.now() };
}
