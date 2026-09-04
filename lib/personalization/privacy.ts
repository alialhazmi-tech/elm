import { and, eq, ne } from "drizzle-orm";

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
