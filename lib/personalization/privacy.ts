import { and, eq, ne, sql } from "drizzle-orm";

import { storyReadingSessions, memberEvents, memberProfiles, memberStoryStats, memberTopicScores } from "@/db/schema";
import { getDb } from "@/lib/db";

export async function setPersonalizationEnabled(memberId: string, enabled: boolean) {
  const db = getDb();
  if (!db) throw new Error("MEMBERSHIP_DATABASE_UNAVAILABLE");
  const now = new Date().toISOString();
  await db
    .insert(memberProfiles)
    .values({
      authUserId: memberId,
      onboardingCompleted: 0,
      personalizationEnabled: enabled ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: memberProfiles.authUserId,
      set: { personalizationEnabled: enabled ? 1 : 0, updatedAt: now },
    });
}

/** وجود أي بيانات يشملها المسح، حتى لقراءة جزئية أو مادة لم تعد منشورة. */
export async function hasBehavioralData(memberId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const result = await db.execute<{ present: boolean }>(sql`
    select (
      exists (select 1 from ${storyReadingSessions} where ${storyReadingSessions.memberId} = ${memberId})
      or exists (select 1 from ${memberEvents} where ${memberEvents.memberId} = ${memberId})
      or exists (select 1 from ${memberStoryStats} where ${memberStoryStats.memberId} = ${memberId})
      or exists (select 1 from ${memberTopicScores} where ${memberTopicScores.memberId} = ${memberId} and ${memberTopicScores.source} <> 'explicit')
    ) as present
  `);
  return result.rows[0].present;
}

/** يمسح الإشارات المستنتجة ويُبقي الاهتمامات الصريحة. */
export async function clearBehavioralData(memberId: string) {
  const db = getDb();
  if (!db) throw new Error("MEMBERSHIP_DATABASE_UNAVAILABLE");
  await db.batch([
    db.delete(storyReadingSessions).where(eq(storyReadingSessions.memberId, memberId)),
    db.delete(memberEvents).where(eq(memberEvents.memberId, memberId)),
    db.delete(memberStoryStats).where(eq(memberStoryStats.memberId, memberId)),
    db.delete(memberTopicScores).where(and(eq(memberTopicScores.memberId, memberId), ne(memberTopicScores.source, "explicit"))),
  ]);
}
