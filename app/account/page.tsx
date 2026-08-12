import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { getMemberProfile } from "@/lib/membership/profile";
import { signOutMember, togglePersonalization, clearInferredSignals } from "./actions";
import "../join/member-auth.css";

export const metadata: Metadata = { title: "حسابي", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  if (!memberAuthConfigured) redirect("/join");
  const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
  if (!data?.user) redirect("/join");
  const { welcome } = await searchParams;
  const name = data.user.name || "عضو العلم";
  const profile = await getMemberProfile(data.user.id);

  return <><SiteHeader /><main className="member-account">{welcome === "1" && <p className="member-welcome">تم إنشاء حسابك وتسجيل دخولك بنجاح.</p>}<header className="member-account-head"><div className="member-account-avatar">{name.slice(0,1)}</div><div><h1>{name}</h1><p>عضو في العلم</p></div><Link className="member-account-home" href="/for-you">افتح صفحتي ←</Link></header><div className="member-account-grid"><section className="member-account-card"><h2>بيانات الحساب</h2><p>البريد الإلكتروني</p><code>{data.user.email}</code></section><section className="member-account-card"><h2>اهتماماتي <span>{profile.interests.length}</span></h2><div className="member-interest-tags">{profile.interests.map((item) => <i key={item.id}>{item.label}</i>)}</div><Link href="/welcome">تعديل الاهتمامات ←</Link></section><section className="member-account-card"><h2>مكتبتي</h2><p>المواد التي تحفظها ستظهر هنا. ربط الحفظ بالمقالات هو الخطوة التالية.</p></section><section className="member-account-card"><h2>الخصوصية والتخصيص</h2><p>التخصيص مرتبط بحسابك: اهتماماتك، إعجاباتك، ومدة القراءة النشطة. لا نستخدم بصمة خفية، ولا نخزن نص محادثاتك مع الذكاء.</p><form action={togglePersonalization} className="member-privacy-row"><input type="hidden" name="enabled" value={profile.personalizationEnabled ? "0" : "1"} /><button className="member-signout" type="submit">{profile.personalizationEnabled ? "إيقاف التخصيص" : "تشغيل التخصيص"}</button></form><form action={clearInferredSignals}><button className="member-signout" type="submit">مسح الإشارات المستنتجة</button></form></section></div><form action={signOutMember} style={{marginTop:18}}><button className="member-signout">تسجيل الخروج</button></form></main><SiteFooter /></>;
}
