import { desc, eq } from "drizzle-orm";
import { memberLikes, memberStoryStats, newsletterSubscribers } from "@/db/schema";
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

  // 1. جلب الإعجابات / المحفوظات
  const likesRows = await db
    .select({
      storyId: memberLikes.storyId,
      createdAt: memberLikes.createdAt,
    })
    .from(memberLikes)
    .where(eq(memberLikes.memberId, userId))
    .orderBy(desc(memberLikes.createdAt))
    .limit(20);

  // حل تفاصيل المواد المحفوظة
  const savedStories: MemberSavedStory[] = [];
  for (const row of likesRows) {
    const story = await seedContentProvider.getStory(row.storyId);
    if (story) {
      savedStories.push({
        story,
        savedAt: row.createdAt,
      });
    }
  }

  // 2. إحصاءات وسجل القراءة
  const statsRows = await db
    .select()
    .from(memberStoryStats)
    .where(eq(memberStoryStats.memberId, userId))
    .orderBy(desc(memberStoryStats.lastVisitAt))
    .limit(20);

  let totalActiveMs = 0;
  let totalAi = 0;
  const recentHistory: MemberHistoryItem[] = [];

  for (const row of statsRows) {
    totalActiveMs += row.activeMs ?? 0;
    totalAi += row.usedAi ?? 0;
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

  const stats: MemberAccountStats = {
    articlesRead: statsRows.length,
    activeMinutes: Math.round(totalActiveMs / 60000),
    savedCount: likesRows.length,
    aiInteractions: totalAi,
  };

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
