import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { SERIES } from "@/lib/content/series";

/** صفحة إرثية من الموقع القديم — روابطها الخارجية محفوظة (شرط M-2). */

export const metadata: Metadata = {
  title: "عن العلم",
  description: "منصة إعلام ومعرفة سعودية تشرح ما وراء الخبر — المعرفة بسلاسة.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />
      <main id="main-content">
        <section className="hub-hero">
          <p className="eyebrow">عن المنصة</p>
          <h1>العلم — المعرفة وراء الخبر</h1>
        </section>
        <div className="wrap" style={{ maxWidth: 720, paddingBottom: 48 }}>
          <p style={{ lineHeight: 1.9 }}>
            «العلم» منصة إعلام ومعرفة سعودية، رسالتها تقديم المعرفة بسلاسة: لا نكتفي بنقل
            الخبر، بل نشرح ما وراءه — أسبابه وسياقه وأرقامه واحتمالاته — بسياسة تحريرية
            مكتوبة تحكم كل مادة قبل نشرها، واعتماد بشري لا يُستثنى منه محتوى.
          </p>
          <p style={{ lineHeight: 1.9 }}>
            ننظر إلى كل قصة من زاويتها الأنسب عبر سلاسلنا المعرفية الثماني:{" "}
            {SERIES.map((series) => series.name).join("، ")} — أرشيفنا الممتد منذ سنوات
            محفوظ بروابطه كاملة على هذه المنصة.
          </p>
          <p style={{ lineHeight: 1.9 }}>
            <Link href="/series">تعرّف على سلاسل العلم ←</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
