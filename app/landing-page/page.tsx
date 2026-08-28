import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";

/**
 * صفحة تسويقية إرثية من الموقع القديم — تُبقى حية لروابطها الخارجية (شرط M-2)
 * خارج الفهرسة حتى لا تزاحم الرئيسية.
 */

export const metadata: Metadata = {
  title: "العلم — المعرفة بسلاسة",
  robots: { index: false, follow: true },
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />
      <main id="main-content">
        <section className="hub-hero">
          <p className="eyebrow">العلم</p>
          <h1>المعرفة وراء الخبر</h1>
          <p className="hub-count">
            انتقلت هذه الصفحة — <Link href="/">تفضل إلى واجهة العلم ←</Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
