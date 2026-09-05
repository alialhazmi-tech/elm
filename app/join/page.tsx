import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, BookOpen, Compass, ShieldCheck } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { memberAuthConfigured } from "@/lib/membership/auth";
import { getMemberProfile } from "@/lib/membership/profile";
import { getMemberSession } from "@/lib/membership/session";
import { signOutMember } from "@/app/account/actions";
import { JoinForm } from "./join-form";
import { safeInternalPath } from "@/lib/membership/paths";
import "./member-auth.css";

export const metadata: Metadata = {
  title: "عضوية العلم",
  description: "مساحتك للقراءة والحفظ واختيار ما يهمك في العلم.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const { next: nextRaw, mode } = await searchParams;
  const next = safeInternalPath(nextRaw);
  if (memberAuthConfigured) {
    const { data, suspended } = await getMemberSession();
    if (suspended)
      return (
        <>
          <SiteHeader />
          <main className="member-auth-shell">
            <section className="member-auth-panel">
              <h1>حسابك معلّق</h1>
              <p>
                الوصول إلى خدمات العضوية موقوف حاليًا. تواصل مع إدارة العلم
                لمراجعة حالة حسابك.
              </p>
              <form
                action={async () => {
                  "use server";
                  await signOutMember();
                }}
              >
                <button className="member-auth-submit">تسجيل الخروج</button>
              </form>
            </section>
          </main>
          <SiteFooter />
        </>
      );
    if (data?.user) {
      const profile = await getMemberProfile(data.user.id);
      redirect(profile.onboardingCompleted ? (next ?? "/account") : "/welcome");
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="member-auth-shell">
        <div className="member-auth-panelset">
          <section className="member-value" aria-labelledby="membership-title">
            <span className="member-auth-kicker">أهلًا بك في العلم</span>
            <h1 id="membership-title">
              مساحتك.
              <br />
              للمعرفة التي تهمّك.
            </h1>
            <p className="member-value-dek">
              قراءاتك، اختياراتك، وما تودّ العودة إليه.
              <br />
              كلّها في مكان واحد، بعضوية مجانية.
            </p>
            <div className="member-reading-note" aria-hidden="true">
              <div className="member-note-top">
                <BookOpen size={22} />
                <span>من الخبر إلى المعرفة</span>
              </div>
              <strong>
                اقرأ اليوم.
                <br />
                واربط الأفكار كل يوم.
              </strong>
              <div className="member-note-lines">
                <span />
                <span />
                <span />
              </div>
              <span className="member-note-save">
                <Bookmark size={16} /> في مكتبتك، حين تحتاجها
              </span>
            </div>
            <ul className="member-perks">
              <li>
                <Compass size={20} />
                <span>
                  <b>ترشيحات أقرب لاهتماماتك</b>
                  <small>اختر الموضوعات التي تحب متابعتها.</small>
                </span>
              </li>
              <li>
                <Bookmark size={20} />
                <span>
                  <b>مكتبة تعود إليها</b>
                  <small>احفظ المواد وتابع سجل قراءاتك.</small>
                </span>
              </li>
              <li>
                <ShieldCheck size={20} />
                <span>
                  <b>أنت تتحكم بتجربتك</b>
                  <small>عدّل اهتماماتك وإعدادات الخصوصية.</small>
                </span>
              </li>
            </ul>
          </section>
          <section className="member-auth-panel" aria-label="حساب العلم">
            <JoinForm
              next={next}
              available={memberAuthConfigured}
              initialMode={mode === "signin" ? "signin" : "signup"}
            />
          </section>
        </div>
        <p className="member-auth-foot">
          <Link href="/">العودة إلى العلم</Link>
          <Link href="/privacy-policy">سياسة الخصوصية</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
