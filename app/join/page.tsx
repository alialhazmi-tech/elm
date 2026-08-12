import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { JoinForm } from "./join-form";
import "./member-auth.css";

export const metadata: Metadata = {
  title: "انضم إلى العلم",
  description: "أنشئ عضويتك في العلم واحفظ موادك واضبط تجربتك.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  if (memberAuthConfigured) {
    const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
    if (data?.user) redirect("/account");
  }

  return (
    <>
      <SiteHeader />
      <main className="member-auth-shell">
        <section className="member-auth-intro">
          <span className="member-auth-kicker">عضوية العلم</span>
          <h1>معرفة أقرب إليك.</h1>
          <p>حساب حقيقي لحفظ موادك، والعودة إليها من أي جهاز. قريبًا نضيف صفحة «لك» واهتماماتك.</p>
          <ul>
            <li><b>حفظ آمن</b><span>تبقى موادك معك بعد تسجيل الدخول</span></li>
            <li><b>خصوصية واضحة</b><span>لا علاقة لعضويتك بحسابات التحرير</span></li>
            <li><b>تحكم كامل</b><span>يمكنك تسجيل الخروج وإدارة حسابك</span></li>
          </ul>
        </section>
        <div>
          {!memberAuthConfigured && <p className="member-auth-unavailable">خدمة العضوية غير مهيأة في هذه البيئة.</p>}
          <JoinForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
