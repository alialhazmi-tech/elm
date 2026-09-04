import { desc, eq, sql } from "drizzle-orm";
import { memberSavedStories, memberStoryStats, newsletterSubscribers } from "@/db/schema";
import { getDb } from "@/lib/db";
import { seedContentProvider } from "@/lib/content/provider";
import { type Story } from "@/lib/content/types";
import { getMemberProfile, type MemberProfile } from "./profile";
import { forYouForMember, type RelatedCard } from "@/lib/personalization/recommend";

export type MemberAccountStats = {
  articlesRead: number;
  activeMinutes: number;
  savedCount: number;
  aiInteractions: number;
};

export type MemberSavedStory = {
  story: Story;
  savedAt: string;
};

export type MemberHistoryItem = {
  story: Story;
  progress: number;
  lastVisitAt: string;
};

export type MemberAccountData = {
  user: {
    id: string;
    name: string;
    email: string;
    joinedAt?: string;
  };
  profile: MemberProfile;
  stats: MemberAccountStats;
  savedStories: MemberSavedStory[];
  recentHistory: MemberHistoryItem[];
  recommendedStories: RelatedCard[];
  newsletterSubscribed: boolean;
};

export async function getMemberAccountData(userId: string, userEmail: string, userName?: string): Promise<MemberAccountData> {
  const db = getDb();
  const profile = await getMemberProfile(userId);

  // إذا لم تتوفر قاعدة البيانات، نرجع بيانات متناسقة وآمنة
  if (!db) {
    const recommended = await forYouForMember(userId, 3).catch(() => []);
    return {
      user: {
        id: userId,
        name: userName || "عضو العلم",
        email: userEmail,
      },
      profile,
      stats: {
        articlesRead: 0,
        activeMinutes: 0,
        savedCount: 0,
        aiInteractions: 0,
      },
      savedStories: [],
      recentHistory: [],
      recommendedStories: recommended,
      newsletterSubscribed: false,
    };
  }

  // 1. جلب المحفوظات المستقلة عن الإعجابات
  const savedRows = await db
    .select({
      storyId: memberSavedStories.storyId,
      createdAt: memberSavedStories.createdAt,
    })
    .from(memberSavedStories)
    .where(eq(memberSavedStories.memberId, userId))
    .orderBy(desc(memberSavedStories.createdAt))
    .limit(20);

  // حل تفاصيل المواد المحفوظة
  const savedStories = (await Promise.all(savedRows.map(async row => {
    const story = await seedContentProvider.getStory(row.storyId);
    return story ? { story, savedAt: row.createdAt } : null;
  }))).filter((item): item is MemberSavedStory => item !== null);

  // 2. إحصاءات وسجل القراءة
  const statsRows = await db
    .select()
    .from(memberStoryStats)
    .where(eq(memberStoryStats.memberId, userId))
    .orderBy(desc(memberStoryStats.lastVisitAt))
    .limit(20);

  const recentHistory: MemberHistoryItem[] = [];

  for (const row of statsRows) {
    if (recentHistory.length < 5) {
      const story = await seedContentProvider.getStory(row.storyId);
      if (story) {
        recentHistory.push({
          story,
          progress: row.maxProgress ?? 0,
          lastVisitAt: row.lastVisitAt,
        });
      }
    }
  }

  // 3. حالة النشرة البريدية
  let newsletterSubscribed = false;
  try {
    const sub = await db
      .select({ id: newsletterSubscribers.id })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, userEmail.trim().toLowerCase()))
      .limit(1);
    newsletterSubscribed = sub.length > 0;
  } catch {
    newsletterSubscribed = false;
  }

  // 4. ترشيحات «لك» الحصرية
  const recommendedStories = await forYouForMember(userId, 3).catch(() => []);

  const [[totals], [saves]] = await Promise.all([
    db.select({ read: sql<number>`count(*) filter (where ${memberStoryStats.maxProgress} >= 90)::int`, minutes: sql<number>`coalesce(sum(${memberStoryStats.activeMs}),0) / 60000`, ai: sql<number>`coalesce(sum(${memberStoryStats.usedAi}),0)::int` }).from(memberStoryStats).where(eq(memberStoryStats.memberId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(memberSavedStories).where(eq(memberSavedStories.memberId, userId)),
  ]);
  const stats: MemberAccountStats = { articlesRead: Number(totals.read), activeMinutes: Math.round(Number(totals.minutes)), savedCount: Number(saves.count), aiInteractions: Number(totals.ai) };

  return {
    user: {
      id: userId,
      name: userName || "عضو العلم",
      email: userEmail,
    },
    profile,
    stats,
    savedStories,
    recentHistory,
    recommendedStories,
    newsletterSubscribed,
  };
}
