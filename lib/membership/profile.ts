import { and, asc, eq, inArray } from "drizzle-orm";
import { interests, memberInterests, memberProfiles } from "@/db/schema";
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

  // neon-http لا يدعم المعاملات التفاعلية؛ عمليات متتابعة صغيرة وآمنة ثم تحقق نهائي.
  await db.delete(memberInterests).where(eq(memberInterests.memberId, memberId));
  if (ids.length) {
    await db.insert(memberInterests).values(ids.map((interestId) => ({ memberId, interestId, createdAt: now }))).onConflictDoNothing();
  }
  await db.insert(memberProfiles).values({ authUserId: memberId, onboardingCompleted: 1, personalizationEnabled: 1, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: memberProfiles.authUserId, set: { onboardingCompleted: 1, updatedAt: now } });
  const { syncExplicitInterests } = await import("@/lib/personalization/interests");
  await syncExplicitInterests(memberId, ids, now);

  const saved = ids.length
    ? await db.select({ id: memberInterests.interestId }).from(memberInterests)
      .where(and(eq(memberInterests.memberId, memberId), inArray(memberInterests.interestId, ids)))
    : [];
  if (saved.length !== ids.length) throw new Error("MEMBERSHIP_INTEREST_SAVE_INCOMPLETE");
  return ids;
}

export async function seedInterestCatalog() {
  const db = getDb();
  if (!db) return;
  await db.insert(interests).values(MEMBER_INTERESTS).onConflictDoNothing();
}
