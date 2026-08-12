import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { signOutMember } from "./actions";
import "../join/member-auth.css";

export const metadata: Metadata = { title: "حسابي", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  if (!memberAuthConfigured) redirect("/join");
  const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
  if (!data?.user) redirect("/join");
  const { welcome } = await searchParams;
  const name = data.user.name || "عضو العلم";

  return <><SiteHeader /><main className="member-account">{welcome === "1" && <p className="member-welcome">تم إنشاء حسابك وتسجيل دخولك بنجاح.</p>}<header className="member-account-head"><div className="member-account-avatar">{name.slice(0,1)}</div><div><h1>{name}</h1><p>عضو في العلم</p></div></header><div className="member-account-grid"><section className="member-account-card"><h2>بيانات الحساب</h2><p>البريد الإلكتروني</p><code>{data.user.email}</code></section><section className="member-account-card"><h2>تجربتك</h2><p>حفظ المواد والاهتمامات وصفحة «لك» ستُربط بهذا الحساب في الدفعة التالية.</p><Link href="/">العودة إلى العلم ←</Link></section></div><form action={signOutMember} style={{marginTop:18}}><button className="member-signout">تسجيل الخروج</button></form></main><SiteFooter /></>;
}
