import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { JakReportIndex } from "@/components/jak-report-index";
import { listJakReports } from "@/lib/tahrir/jak-reports";


/** جاك العلم — الملفات الكبرى بقالب القراءة الغامر؛ دليلها العام. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "جاك العلم",
  description: "ملفات كبرى تشكل العالم، نحللها ونضعها في سياقها التاريخي بقالب قراءة غامر.",
  alternates: { canonical: "/jak" },
};

export default async function JakIndexPage() {
  const reports = await listJakReports({ publicOnly: true, limit: 100 });

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader active="/jak" />

      <main id="main-content" className="wrap sx-page">
        <JakReportIndex reports={reports} />
      </main>

      <SiteFooter />
    </>
  );
}
