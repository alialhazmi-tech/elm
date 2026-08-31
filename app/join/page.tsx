import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/app/_components/site-chrome";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { MEMBER_INTERESTS } from "@/lib/membership/interests";
import { getMemberProfile } from "@/lib/membership/profile";
import { JoinForm } from "./join-form";
import { safeInternalPath } from "@/lib/membership/paths";
import "./member-auth.css";

/** ما تفتحه العضوية فعلًا — كل مزية لها مقابل قائم في المنتج. */
const PERKS = [
  { icon: "✦", title: "صفحة «لك» الذكية", desc: "خلاصة مخصصة تشرح سبب كل ترشيح: «لأنك تتابع بالأرقام»." },
  { icon: "☆", title: "احفظ وأكمل لاحقًا", desc: "مكتبتك الخاصة، وموضع القراءة والاستماع يُحفظ عبر أجهزتك." },
  { icon: "✉", title: "نشرة «ما وراء العناوين»", desc: "موجز أسبوعي هادئ بلا إعلانات — إلغاء الاشتراك بنقرة." },
  { icon: "◷", title: "أدوات القارئ", desc: "لخّص لي، واسأل عن المادة، والاستماع الصوتي داخل كل مادة." },
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
                <span className="member-perk-ico" aria-hidden="true">{perk.icon}</span>
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
