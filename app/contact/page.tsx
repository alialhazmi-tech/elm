import type { Metadata } from "next";

import { PublicEmailLink } from "@/app/_components/public-email-link";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";

export const metadata: Metadata = {
  title: "تواصل معنا",
  description: "عنوان ورقم هاتف وبريد فريق منصة العلم.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />
      <main id="main-content" className="info-page">
        <section className="hub-hero info-hero">
          <div>
            <p className="eyebrow">اتصل بنا</p>
            <h1>تواصل معنا</h1>
          </div>
          <p className="hub-desc">لا تتردد في التواصل معنا، سنرد بأسرع وقت على كل استفساراتك.</p>
        </section>

        <article className="info-shell contact-shell">
          <section className="info-lead contact-intro">
            <p>يسعدنا استقبال ملاحظاتك واستفساراتك عبر إحدى القنوات التالية.</p>
          </section>

          <address className="contact-list">
            <div className="contact-row">
              <span className="contact-label">العنوان</span>
              <p>شارع الأمير ناصر بن سعود، حي الصحافة، الرياض 13321، المملكة العربية السعودية</p>
            </div>
            <div className="contact-row">
              <span className="contact-label">الهاتف</span>
              <a href="tel:+966552653222" dir="ltr">+966 55 265 3222</a>
            </div>
            <div className="contact-row">
              <span className="contact-label">البريد الإلكتروني</span>
              <PublicEmailLink email="alelm@trenddc.com" />
            </div>
          </address>

          <PublicEmailLink email="alelm@trenddc.com" label="إرسال رسالة" className="contact-action" />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
