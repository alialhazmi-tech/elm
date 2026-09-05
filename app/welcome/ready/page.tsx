import { getMemberSession } from "@/lib/membership/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { memberAuthConfigured } from "@/lib/membership/auth";
import { getMemberProfile } from "@/lib/membership/profile";
import "../welcome.css";

export const dynamic = "force-dynamic";

export default async function ReadyPage() {
  if (!memberAuthConfigured) redirect("/join");
  const { data } = await getMemberSession();
  if (!data?.user) redirect("/join");
  const profile = await getMemberProfile(data.user.id);
  if (!profile.onboardingCompleted) redirect("/welcome");

  const name = (data.user.name || "صديق العلم").split(" ")[0];
  return <main className="ready-shell"><div className="ready-check">✓</div><span>جاهزون يا {name}</span><h1>جهّزنا العلم لك</h1><p>رتّبنا البداية حول {profile.interests.length} اهتمامات اخترتها، مع مساحة دائمة للاكتشاف واختيارات المحررين.</p><div className="ready-tags">{profile.interests.map((item) => <i key={item.id}>{item.label}</i>)}</div><Link href="/for-you">افتح صفحتي ←</Link><small>يمكنك تعديل كل شيء من حسابك</small></main>;
}
