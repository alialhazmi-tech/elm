import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { toLatinDigits } from "@/lib/format";
import { SERIES, seedContentProvider } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "سلاسل العلم",
  description: "ثماني سلاسل معرفية تشرح الخبر من زوايا مختلفة: التبسيط، البيانات، الحقيقة، السياق، والاحتمالات.",
  alternates: { canonical: "/series" },
};

export default async function SeriesIndexPage() {
  const catalog = await Promise.all(
    SERIES.map(async (series) => ({
      series,
      stories: await seedContentProvider.listBySeries(series.slug),
    })),
  );

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
          {catalog.map(({ series, stories }, index) => {
            const latest = stories[0];
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
                    {toLatinDigits(stories.length)} مادة
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
      </main>

      <SiteFooter />
    </>
  );
}
