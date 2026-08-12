import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/app/_components/site-chrome";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { getMemberProfile } from "@/lib/membership/profile";
import { JoinForm } from "./join-form";
import { safeInternalPath } from "@/lib/membership/paths";
import "./member-auth.css";

export const metadata: Metadata = {
  title: "انضم إلى العلم",
  description: "أنشئ عضويتك في العلم واضبط تجربتك.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: nextRaw } = await searchParams;
  const next = safeInternalPath(nextRaw);
  if (memberAuthConfigured) {
    const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
    if (data?.user) {
      const profile = await getMemberProfile(data.user.id);
      redirect(profile.onboardingCompleted ? (next ?? "/for-you") : "/welcome");
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="member-auth-shell">
        <section className="member-auth-panel">
          <header className="member-auth-head">
            <span className="member-auth-kicker">عضوية العلم</span>
            <h1>انضم إلى العلم</h1>
            <p>حساب واحد يحفظ تجربتك ويجهّز صفحة «لك» حسب اهتماماتك.</p>
          </header>

          {!memberAuthConfigured ? (
            <p className="member-auth-unavailable" role="status">
              خدمة العضوية غير مفعّلة في هذه البيئة بعد — يمكنك معاينة النموذج فقط.
            </p>
          ) : null}

          <JoinForm next={next} />

          <p className="member-auth-foot">
            <Link href="/">العودة إلى الرئيسية</Link>
            <span aria-hidden="true">·</span>
            <span>عضوية الجمهور مستقلة عن حسابات التحرير</span>
          </p>
        </section>
      </main>
    </>
  );
}
