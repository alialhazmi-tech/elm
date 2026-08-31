import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { MEMBER_INTERESTS } from "@/lib/membership/interests";
import { getMemberProfile } from "@/lib/membership/profile";
import { JoinForm } from "./join-form";
import { safeInternalPath } from "@/lib/membership/paths";
import "./member-auth.css";

/** ما تفتحه العضوية فعلًا — كل مزية لها مقابل قائم في المنتج. */
const PERKS = [
  {
    title: "صفحة «لك» الذكية",
    desc: "خلاصة مخصصة تشرح سبب كل ترشيح: «لأنك تتابع بالأرقام».",
    paths: ["M12 3.2l2.2 5.1 5.6.5-4.2 3.7 1.2 5.4L12 15.1 7.2 17.9l1.2-5.4L4.2 8.8l5.6-.5L12 3.2z"],
  },
  {
    title: "احفظ وأكمل لاحقًا",
    desc: "مكتبتك الخاصة، وموضع القراءة والاستماع يُحفظ عبر أجهزتك.",
    paths: ["M6.5 3.8h11v16.4l-5.5-3.7-5.5 3.7V3.8z"],
  },
  {
    title: "نشرة «ما وراء العناوين»",
    desc: "موجز أسبوعي هادئ بلا إعلانات — إلغاء الاشتراك بنقرة.",
    paths: ["M3.2 6.4h17.6v11.2H3.2z", "M3.6 7l8.4 6 8.4-6"],
  },
  {
    title: "أدوات القارئ",
    desc: "لخّص لي، واسأل عن المادة، والاستماع الصوتي داخل كل مادة.",
    paths: [
      "M4.2 14.2v-2a7.8 7.8 0 0115.6 0v2",
      "M4.2 13.8h3v5.4H5.7a1.5 1.5 0 01-1.5-1.5v-3.9z",
      "M19.8 13.8h-3v5.4h1.5a1.5 1.5 0 001.5-1.5v-3.9z",
    ],
  },
];

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
        <div className="member-auth-panelset">
          <section className="member-value" aria-label="لماذا العضوية">
            <span className="member-auth-kicker">عضوية العلم</span>
            <h1>حساب واحد يجعل العلم صحيفتك أنت</h1>
            <p className="member-value-dek">
              أنشئ عضويتك المجانية واضبط تجربتك — نخصص لك صفحة «لك»، نحفظ ما بدأت قراءته،
              ونشرح دائمًا لماذا نرشح لك كل مادة.
            </p>

            <ul className="member-perks">
              {PERKS.map((perk) => (
                <li key={perk.title}>
                  <span className="member-perk-ico" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      {perk.paths.map((d) => <path key={d} d={d} />)}
                    </svg>
                  </span>
                  <span className="member-perk-body">
                    <b>{perk.title}</b>
                    <span>{perk.desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="member-interests-preview">
              <span className="member-interests-lbl">عند التسجيل ستختار اهتماماتك — مثل:</span>
              <div className="member-interests-row">
                {MEMBER_INTERESTS.slice(0, 8).map((interest) => (
                  <span key={interest.id} style={{ "--interest": interest.color } as React.CSSProperties}>
                    <i aria-hidden="true" />
                    {interest.label}
                  </span>
                ))}
            </div>
            <span className="member-interests-privacy">
              بياناتك تبقى عندنا — لا نبيعها ولا نشاركها، ويمكنك حذف حسابك متى شئت.
            </span>
          </div>
        </section>

        <section className="member-auth-panel">
          {!memberAuthConfigured ? (
            <p className="member-auth-unavailable" role="status">
              خدمة العضوية غير مفعّلة في هذه البيئة بعد — يمكنك معاينة النموذج فقط.
            </p>
          ) : null}

          <JoinForm next={next} />
        </section>
        </div>

        <p className="member-auth-foot">
          <Link href="/">العودة إلى الرئيسية</Link>
          <span aria-hidden="true">·</span>
          <span>عضوية الجمهور مستقلة عن حسابات التحرير</span>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
