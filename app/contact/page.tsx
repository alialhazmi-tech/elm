import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";

/** صفحة إرثية من الموقع القديم — روابطها الخارجية محفوظة (شرط M-2). */

export const metadata: Metadata = {
  title: "تواصل معنا",
  description: "قنوات التواصل مع فريق منصة العلم.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />
      <main id="main-content">
        <section className="hub-hero">
          <p className="eyebrow">تواصل</p>
          <h1>يسعدنا أن نسمع منك</h1>
        </section>
        <div className="wrap" style={{ maxWidth: 720, paddingBottom: 48 }}>
          <p style={{ lineHeight: 1.9 }}>
            تصلنا ملاحظاتكم ومقترحاتكم عبر حسابات «العلم» الرسمية في منصات التواصل،
            وعبر الاشتراك في نشرتنا البريدية أسفل أي صفحة — نقرأ كل ما يصلنا.
          </p>
          <p style={{ lineHeight: 1.9 }}>
            وللاطلاع على منهجيتنا التحريرية وسلاسلنا المعرفية:{" "}
            <Link href="/about">عن العلم</Link> · <Link href="/series">سلاسل العلم</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
