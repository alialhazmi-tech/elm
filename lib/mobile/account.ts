import type { MemberAccountData } from "@/lib/membership/account-data";
import { toMobileCard, type MobileStoryCard } from "@/lib/mobile/home";

export const MOBILE_ACCOUNT_CONTRACT = "mobile-account.v1";

export type MobileAccountItem = { story: MobileStoryCard; savedAt?: string; progress?: number; lastVisitAt?: string };

/** المحفوظات (الافتراضي والنظرة العامة) أو الإعجابات أو سجل القراءة بحسب التبويب. */
export function accountItems(data: MemberAccountData, tab: string, origin: string): MobileAccountItem[] {
  if (tab === "liked") return data.likedStories.map((item) => ({ story: toMobileCard(item.story, origin), savedAt: item.savedAt }));
  if (tab === "history") {
    return data.recentHistory.map((item) => ({ story: toMobileCard(item.story, origin), progress: item.progress, lastVisitAt: item.lastVisitAt }));
  }
  return data.savedStories.map((item) => ({ story: toMobileCard(item.story, origin), savedAt: item.savedAt }));
}
