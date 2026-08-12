import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { getMemberProfile } from "@/lib/membership/profile";
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
    if (data?.user) {
      const profile = await getMemberProfile(data.user.id);
      redirect(profile.onboardingCompleted ? "/for-you" : "/welcome");
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="member-auth-shell">
        <section className="member-auth-intro">
          <span className="member-auth-kicker">عضوية العلم</span>
          <h1>معرفة أقرب إليك.</h1>
          <p>حساب حقيقي يبدأ باهتماماتك، ثم يجهّز لك صفحة «لك» بمعرفة أقرب إلى فضولك.</p>
          <ul>
            <li><b>ترحيب شخصي</b><span>نبدأ باسمك ثم نضبط العلم على اهتماماتك</span></li>
            <li><b>خصوصية واضحة</b><span>لا علاقة لعضويتك بحسابات التحرير</span></li>
            <li><b>صفحة لك</b><span>توصيات مفهومة ويمكنك تعديل اهتماماتك متى شئت</span></li>
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
