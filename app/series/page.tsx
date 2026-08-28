import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { toLatinDigits } from "@/lib/format";
import { listVisibleArchivedSeries, SERIES, seriesDirectory } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";

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

      <main id="main-content" className="series-index-page">
        <section className="series-index-hero">
          <div className="series-index-copy">
            <p className="series-index-kicker">سلاسل العلم</p>
            <h1>ثماني طرق لرؤية الخبر كاملًا.</h1>
            <p>
              لا نكتفي بتصنيف ما يحدث. نختار لكل قصة الطريقة الأنسب لفهمها:
              نشرح المعقد، نختبر الشائعة، نقرأ الأرقام، ونبني احتمالات المستقبل.
            </p>
          </div>
          <div className="series-index-stat" aria-label="ثماني سلاسل معرفية">
            <b className="latin-number" dir="ltr" lang="en">{toLatinDigits(SERIES.length)}</b>
            <span>سلاسل معرفية</span>
            <small>هوية واحدة، زوايا متعددة</small>
          </div>
        </section>

        <section className="wrap series-directory" aria-label="دليل سلاسل العلم">
          {catalog.map(({ series, count, latest }, index) => {
            return (
              <article
                key={series.slug}
                className="series-directory-card"
                style={{ "--sc": series.color } as React.CSSProperties}
              >
                <div className="series-directory-top">
                  <span className="series-directory-no latin-number" dir="ltr" lang="en" aria-hidden="true">
                    {toLatinDigits(String(index + 1).padStart(2, "0"))}
                  </span>
                  <span className="series-directory-count">
                    {toLatinDigits(count)} مادة
                  </span>
                </div>
                <h2>{series.name}</h2>
                <p>{series.description}</p>
                {latest ? (
                  <div className="series-directory-latest">
                    <span>أحدث مادة</span>
                    <Link href={storyHref(latest)}>{latest.title}</Link>
                  </div>
                ) : (
                  <div className="series-directory-latest is-empty">مواد السلسلة في الطريق.</div>
                )}
                <Link className="series-directory-cta" href={`/series/${series.slug}`}>
                  ادخل السلسلة <span aria-hidden="true">←</span>
                </Link>
              </article>
            );
          })}
        </section>

        {archivedCatalog.length > 0 && (
          <section className="wrap series-archive" aria-label="أرشيف السلاسل">
            <h2 className="series-archive-title">من أرشيف العلم</h2>
            <p className="series-archive-desc">
              سلاسل اكتملت رسالتها وتوقفت عن النشر الجديد — موادها باقية حية بروابطها.
            </p>
            <div className="series-archive-grid">
              {archivedCatalog.map(({ series, count }) => (
                <Link
                  key={series.slug}
                  className="series-archive-card"
                  href={`/series/${series.slug}`}
                  style={{ "--sc": series.color } as React.CSSProperties}
                >
                  <span className="series-archive-name">{series.name}</span>
                  <span className="series-archive-meta">
                    {toLatinDigits(count)} مادة · أرشيف
                  </span>
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
