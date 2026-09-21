import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { AccountView } from "@/app/account/account-view";
import { accountTab, emptyAccountData } from "@/lib/membership/account-data";
import { MEMBER_INTERESTS } from "@/lib/membership/interests";
import { seedStories } from "@/lib/content/seed";
import "@/app/account/account.css";
export const metadata: Metadata = {
  title: "معاينة ملف العضو",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function AccountPreview({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; empty?: string; unverified?: string }>;
}) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.MEMBERSHIP_PROTOTYPE !== "1"
  )
    notFound();
  const params = await searchParams;
  const data = emptyAccountData(
    "preview-only",
    "reader@example.com",
    "عبدالله محمد",
  );
  data.available = true;
  data.user.joinedAt = "2026-08-01T10:00:00Z";
  data.user.emailVerified = params.unverified !== "1";
  if (params.empty !== "1") {
    data.hasBehavioralData = true;
    data.profile = {
      onboardingCompleted: true,
      personalizationEnabled: true,
      interests: MEMBER_INTERESTS.slice(0, 5),
    };
    data.stats = {
      articlesRead: 24,
      activeMinutes: 136,
      savedCount: 8,
      likedCount: 12,
      aiInteractions: 3,
    };
    data.savedStories = seedStories
      .slice(0, 3)
      .map((story) => ({ story, savedAt: "2026-09-04T10:00:00Z" }));
    data.likedStories = data.savedStories;
    data.recentHistory = seedStories
      .slice(3, 6)
      .map((story, index) => ({
        story,
        progress: [42, 76, 100][index],
        lastVisitAt: "2026-09-04T10:00:00Z",
      }));
  }
  return (
    <>
      <SiteHeader memberPreview={{ name: data.user.name, emailVerified: data.user.emailVerified }} />
      <div
        style={{
          textAlign: "center",
          padding: 10,
          fontSize: 12,
          background: "#e9f0fa",
          color: "#24466f",
        }}
        role="status"
      >
        معاينة التصميم — بيانات توضيحية، وليست حسابًا فعليًا
      </div>
      <AccountView
        basePath="/prototype/account"
        data={data}
        tab={accountTab(params.tab)}
      />
      <SiteFooter />
    </>
  );
}
