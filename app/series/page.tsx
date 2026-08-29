import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { toLatinDigits } from "@/lib/format";
import { listVisibleArchivedSeries, SERIES, seriesDirectory } from "@/lib/content/provider";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "سلاسل العلم",
  description: "ثماني سلاسل معرفية تشرح الخبر من زوايا مختلفة: التبسيط، البيانات، الحقيقة، السياق، والاحتمالات.",
  alternates: { canonical: "/series" },
};

export default async function SeriesIndexPage() {
  const archived = await listVisibleArchivedSeries();
  // دليل واحد بكاش دقيقة: أعداد كل السلاسل وأحدث مادة للنشطة — بلا تحميل الأرشيف.
  const directory = await seriesDirectory();
  const archivedCatalog = archived.map((series) => ({
    series,
    count: directory[series.slug]?.count ?? 0,
  }));
  const catalog = SERIES.map((series) => ({
    series,
    count: directory[series.slug]?.count ?? 0,
    latest: directory[series.slug]?.latest ?? null,
  }));

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader active="/series" />

      <main id="main-content" className="wrap sx-page">
        <section className="sx-index-hero">
          <span className="kick">سلاسل العلم</span>
          <h1>ثماني طرق لرؤية الخبر كاملًا</h1>
          <p>
            لا نكتفي بتصنيف ما يحدث. نختار لكل قصة الطريقة الأنسب لفهمها:
            نشرح المعقد، نختبر الشائعة، نقرأ الأرقام، ونبني احتمالات المستقبل.
          </p>
        </section>

        <section className="sx-directory" aria-label="دليل سلاسل العلم">
          {catalog.map(({ series, count, latest }) => (
            <Link
              key={series.slug}
              className="sx-tile"
              href={`/series/${series.slug}`}
              style={{ "--sc": series.color } as React.CSSProperties}
            >
              <span className="sname">{series.name}</span>
              <span className="sdesc">{series.description}</span>
              {latest ? (
                <span className="slatest">
                  <small>أحدث مادة</small>
                  {latest.title}
                </span>
              ) : (
                <span className="slatest"><small>مواد السلسلة في الطريق.</small></span>
              )}
              <span className="scount">{toLatinDigits(count)} مادة ←</span>
            </Link>
          ))}
        </section>

        {archivedCatalog.length > 0 && (
          <section className="sx-archive" aria-label="أرشيف السلاسل">
            <div className="section-head">
              <h2>من أرشيف العلم</h2>
              <span className="sub">سلاسل اكتملت رسالتها — موادها باقية حية بروابطها</span>
            </div>
            <div className="sx-archive-row">
              {archivedCatalog.map(({ series, count }) => (
                <Link
                  key={series.slug}
                  href={`/series/${series.slug}`}
                  style={{ "--sc": series.color } as React.CSSProperties}
                >
                  <b>{series.name}</b>
                  <span className="meta">{toLatinDigits(count)} مادة</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
