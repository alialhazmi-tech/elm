import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/app/_components/site-chrome";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { getMemberProfile } from "@/lib/membership/profile";
import { InterestPicker } from "./interest-picker";
import "./welcome.css";

export const metadata: Metadata = { title: "اهتماماتك", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  if (!memberAuthConfigured) redirect("/join");
  const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
  if (!data?.user) redirect("/join");
  const profile = await getMemberProfile(data.user.id);

  return <><SiteHeader /><main className="onboard-shell"><div className="onboard-progress"><span /></div><InterestPicker name={(data.user.name || "صديق العلم").split(" ")[0]} initial={profile.interests.map((item) => item.id)} /></main></>;
}
