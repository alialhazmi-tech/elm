import { and, desc, eq, gt, sql } from "drizzle-orm";
import {
  memberLikes,
  memberSavedStories,
  memberStoryStats,
  newsletterSubscribers,
  stories,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { seedContentProvider } from "@/lib/content/provider";
import { type Story } from "@/lib/content/types";
import { getMemberProfile, type MemberProfile } from "./profile";
import { hasBehavioralData } from "@/lib/personalization/privacy";
import {
  forYouForMember,
  type RelatedCard,
} from "@/lib/personalization/recommend";

export const ACCOUNT_TABS = [
  "overview",
  "saved",
  "liked",
  "history",
  "interests",
  "settings",
] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];
export const ACCOUNT_PAGE_SIZE = 12;
export type MemberAccountStats = {
  articlesRead: number;
  activeMinutes: number;
  savedCount: number;
  likedCount: number;
  aiInteractions: number;
};
export type MemberSavedStory = { story: Story; savedAt: string };
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
    emailVerified?: boolean;
    image?: string | null;
  };
  profile: MemberProfile;
  stats: MemberAccountStats;
  savedStories: MemberSavedStory[];
  likedStories: MemberSavedStory[];
  recentHistory: MemberHistoryItem[];
  recommendedStories: RelatedCard[];
  newsletterSubscribed: boolean;
  hasBehavioralData: boolean;
  page: number;
  pageCount: number;
  available: boolean;
};
export function accountTab(raw?: string): AccountTab {
  return ACCOUNT_TABS.includes(raw as AccountTab)
    ? (raw as AccountTab)
    : "overview";
}
export function emptyAccountData(
  userId: string,
  email: string,
  name: string,
): MemberAccountData {
  return {
    user: { id: userId, name, email },
    profile: {
      onboardingCompleted: false,
      personalizationEnabled: false,
      interests: [],
    },
    stats: {
      articlesRead: 0,
      activeMinutes: 0,
      savedCount: 0,
      likedCount: 0,
      aiInteractions: 0,
    },
    savedStories: [],
    likedStories: [],
    recentHistory: [],
    recommendedStories: [],
    newsletterSubscribed: false,
    hasBehavioralData: false,
    page: 1,
    pageCount: 1,
    available: false,
  };
}

/** Private, uncached account reads; caller derives the member ID from the session. */
export async function getMemberAccountData(
  userId: string,
  userEmail: string,
  userName = "عضو العلم",
  tab: AccountTab = "overview",
  requestedPage = 1,
): Promise<MemberAccountData> {
  const db = getDb();
  if (!db) return emptyAccountData(userId, userEmail, userName);
  const published = eq(stories.status, "published");
  const savedWhere = and(eq(memberSavedStories.memberId, userId), published);
  const likedWhere = and(eq(memberLikes.memberId, userId), published);
  const historyWhere = and(
    eq(memberStoryStats.memberId, userId),
    gt(memberStoryStats.visits, 0),
    published,
  );
  const [profile, [totals], [saves], [likes], newsletter, behavioralDataPresent] = await Promise.all([
    getMemberProfile(userId),
    db
      .select({
        read: sql<number>`count(*) filter (where ${memberStoryStats.maxProgress} >= 90)::int`,
        minutes: sql<number>`coalesce(sum(${memberStoryStats.activeMs}), 0) / 60000`,
        ai: sql<number>`count(*) filter (where ${memberStoryStats.usedAi} > 0)::int`,
        history: sql<number>`count(*) filter (where ${memberStoryStats.visits} > 0)::int`,
      })
      .from(memberStoryStats)
      .innerJoin(stories, eq(stories.id, memberStoryStats.storyId))
      .where(and(eq(memberStoryStats.memberId, userId), published)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(memberSavedStories)
      .innerJoin(stories, eq(stories.id, memberSavedStories.storyId))
      .where(savedWhere),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(memberLikes)
      .innerJoin(stories, eq(stories.id, memberLikes.storyId))
      .where(likedWhere),
    db
      .select({ id: newsletterSubscribers.id })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, userEmail.trim().toLowerCase()))
      .limit(1),
    hasBehavioralData(userId),
  ]);
  const total =
    tab === "saved"
      ? saves.count
      : tab === "liked"
        ? likes.count
        : tab === "history"
          ? totals.history
          : 0;
  const pageCount = Math.max(1, Math.ceil(Number(total) / ACCOUNT_PAGE_SIZE));
  const page = Math.max(
    1,
    Math.min(
      Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1,
      pageCount,
    ),
  );
  const offset = (page - 1) * ACCOUNT_PAGE_SIZE;
  const [savedRows, likedRows, historyRows, recommendedStories] =
    await Promise.all([
      tab === "overview" || tab === "saved"
        ? db
            .select({
              storyId: memberSavedStories.storyId,
              createdAt: memberSavedStories.createdAt,
            })
            .from(memberSavedStories)
            .innerJoin(stories, eq(stories.id, memberSavedStories.storyId))
            .where(savedWhere)
            .orderBy(
              desc(memberSavedStories.createdAt),
              memberSavedStories.storyId,
            )
            .limit(tab === "overview" ? 3 : ACCOUNT_PAGE_SIZE)
            .offset(tab === "saved" ? offset : 0)
        : [],
      tab === "liked"
        ? db
            .select({
              storyId: memberLikes.storyId,
              createdAt: memberLikes.createdAt,
            })
            .from(memberLikes)
            .innerJoin(stories, eq(stories.id, memberLikes.storyId))
            .where(likedWhere)
            .orderBy(desc(memberLikes.createdAt), memberLikes.storyId)
            .limit(ACCOUNT_PAGE_SIZE)
            .offset(offset)
        : [],
      tab === "overview" || tab === "history"
        ? db
            .select({
              storyId: memberStoryStats.storyId,
              maxProgress: memberStoryStats.maxProgress,
              lastVisitAt: memberStoryStats.lastVisitAt,
            })
            .from(memberStoryStats)
            .innerJoin(stories, eq(stories.id, memberStoryStats.storyId))
            .where(historyWhere)
            .orderBy(
              desc(memberStoryStats.lastVisitAt),
              memberStoryStats.storyId,
            )
            .limit(tab === "overview" ? 3 : ACCOUNT_PAGE_SIZE)
            .offset(tab === "history" ? offset : 0)
        : [],
      tab === "overview" ? forYouForMember(userId, 3).catch(() => []) : [],
    ]);
  async function resolveSaved(
    rows: typeof savedRows,
  ): Promise<MemberSavedStory[]> {
    return (
      await Promise.all(
        rows.map(async (row) => {
          const story = await seedContentProvider.getStory(row.storyId);
          return story ? { story, savedAt: row.createdAt } : null;
        }),
      )
    ).filter((item): item is MemberSavedStory => item !== null);
  }
  const [savedStories, likedStories, recentHistory] = await Promise.all([
    resolveSaved(savedRows),
    resolveSaved(likedRows),
    Promise.all(
      historyRows.map(async (row) => {
        const story = await seedContentProvider.getStory(row.storyId);
        return story
          ? {
              story,
              progress: Math.max(0, Math.min(100, row.maxProgress ?? 0)),
              lastVisitAt: row.lastVisitAt,
            }
          : null;
      }),
    ).then((items) =>
      items.filter((item): item is MemberHistoryItem => item !== null),
    ),
  ]);
  return {
    user: { id: userId, name: userName, email: userEmail },
    profile,
    stats: {
      articlesRead: Number(totals.read),
      activeMinutes: Math.round(Number(totals.minutes)),
      savedCount: Number(saves.count),
      likedCount: Number(likes.count),
      aiInteractions: Number(totals.ai),
    },
    savedStories,
    likedStories,
    recentHistory,
    recommendedStories,
    newsletterSubscribed: newsletter.length > 0,
    hasBehavioralData: behavioralDataPresent,
    page,
    pageCount,
    available: true,
  };
}
