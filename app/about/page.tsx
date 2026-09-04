import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";

export const metadata: Metadata = {
  title: "من نحن",
  description: "العلم منصة إعلامية معرفية متخصصة في جلب المعرفة بسلاسة وتميز.",
  alternates: { canonical: "/about" },
};

const GOALS = [
  "تقديم محتوى إعلامي معرفي متميز.",
  "الخيار الأول للاطلاع على ما وراء الأخبار والأحداث الرئيسية في السعودية والعالم.",
  "صناعة التأثير عبر الإعلام، والمساهمة في التنمية الوطنية الشاملة.",
];

export default function AboutPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />
      <main id="main-content" className="info-page">
        <section className="hub-hero info-hero">
          <div>
            <p className="eyebrow">عن العلم</p>
            <h1>من نحن</h1>
          </div>
          <p className="hub-desc">منصة إعلامية معرفية تجمع بين الكتابة والصورة.</p>
        </section>

        <article className="info-shell">
          <section className="info-lead">
            <p>
              العلم منصة إعلامية معرفية، تجمع بين الكتابة والصورة بأسلوب جذاب، متخصصة
              في جلب المعرفة بسلاسة وتميز.
            </p>
          </section>

          <section className="info-section info-highlight">
            <p className="info-label">الرؤية</p>
            <h2>المنصة المعرفية اليومية للمتلقي</h2>
          </section>

          <section className="info-section">
            <h2>الأهداف</h2>
            <ul className="info-list">
              {GOALS.map((goal) => <li key={goal}>{goal}</li>)}
            </ul>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
