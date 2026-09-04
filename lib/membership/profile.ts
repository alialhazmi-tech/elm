import { topicKey, WEIGHTS } from "@/lib/personalization/math";
import { and, asc, eq, sql } from "drizzle-orm";
import { interests, memberInterests, memberProfiles, memberTopicScores } from "@/db/schema";
import { getDb } from "@/lib/db";
import { MEMBER_INTERESTS, MEMBER_INTEREST_IDS, type MemberInterest } from "./interests";

export type MemberProfile = {
  onboardingCompleted: boolean;
  personalizationEnabled: boolean;
  interests: MemberInterest[];
};

export async function getMemberProfile(memberId: string): Promise<MemberProfile> {
  const db = getDb();
  if (!db) return { onboardingCompleted: false, personalizationEnabled: true, interests: [] };

  const [profiles, selected] = await Promise.all([
    db.select().from(memberProfiles).where(eq(memberProfiles.authUserId, memberId)).limit(1),
    db.select({ id: interests.id, label: interests.label, description: interests.description, color: interests.color, contentKeys: interests.contentKeys, position: interests.position })
      .from(memberInterests)
      .innerJoin(interests, and(eq(memberInterests.interestId, interests.id), eq(interests.active, 1)))
      .where(eq(memberInterests.memberId, memberId))
      .orderBy(asc(interests.position)),
  ]);

  const profile = profiles[0];
  return {
    onboardingCompleted: profile?.onboardingCompleted === 1,
    personalizationEnabled: profile?.personalizationEnabled !== 0,
    interests: selected.map((row) => ({ ...row, contentKeys: Array.isArray(row.contentKeys) ? row.contentKeys as string[] : [] })),
  };
}

export async function saveMemberInterests(memberId: string, requestedIds: string[]) {
  const db = getDb();
  if (!db) throw new Error("MEMBERSHIP_DATABASE_UNAVAILABLE");
  const ids = [...new Set(requestedIds)].filter((id) => MEMBER_INTEREST_IDS.has(id)).slice(0, 12);
  const now = new Date().toISOString();

  // اختيار الاهتمامات ووزنها الصريح يكتبان معًا؛ لا يوجد فراغ بين الحذف والإضافة.
  await db.batch([
    db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${memberId}, 81234))`),
    db.delete(memberInterests).where(eq(memberInterests.memberId, memberId)),
    ...(ids.length ? [db.insert(memberInterests).values(ids.map(interestId => ({ memberId, interestId, createdAt: now })))] : []),
    db.insert(memberProfiles).values({ authUserId: memberId, onboardingCompleted: 1, personalizationEnabled: 1, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: memberProfiles.authUserId, set: { onboardingCompleted: 1, updatedAt: now } }),
    db.delete(memberTopicScores).where(and(eq(memberTopicScores.memberId, memberId), eq(memberTopicScores.source, "explicit"))),
    ...(ids.length ? [db.insert(memberTopicScores).values(ids.map(id => ({ memberId, topicKey: topicKey("interest", id), kind: "interest", source: "explicit", weight: WEIGHTS.explicit, updatedAt: now }))).onConflictDoUpdate({ target: [memberTopicScores.memberId, memberTopicScores.topicKey], set: { kind: "interest", source: "explicit", weight: WEIGHTS.explicit, updatedAt: now } })] : []),
  ]);

  return ids;
}

export async function seedInterestCatalog() {
  const db = getDb();
  if (!db) return;
  await db.insert(interests).values(MEMBER_INTERESTS).onConflictDoNothing();
}
