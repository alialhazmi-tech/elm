import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { toLatinDigits } from "@/lib/format";
import { MosaicCard } from "@/app/_components/story-card";
import { ALL_SERIES, SERIES, seedContentProvider } from "@/lib/content/provider";

export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  // المتقاعدة تُبنى أيضًا — أرشيفها حي بقرار المالك.
  return ALL_SERIES.map((series) => ({ slug: series.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const series = await seedContentProvider.getSeries(slug);
  if (!series) return { title: "السلسلة غير موجودة" };

  return {
    title: `سلسلة ${series.name}`,
    description: series.description,
    alternates: { canonical: `/series/${series.slug}` },
  };
}

export default async function SeriesPage({ params }: Params) {
  const { slug } = await params;
  const series = await seedContentProvider.getSeries(slug);
  if (!series) notFound();

  const stories = await seedContentProvider.listBySeries(series.slug);
  const seriesIndex = SERIES.findIndex((item) => item.slug === series.slug);

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader active="/series" />

      <main id="main-content">
        <section className="hub-hero series-detail-hero" style={{ "--sc": series.color } as React.CSSProperties}>
          <div>
            <p className="eyebrow">
              {series.archived
                ? "من أرشيف العلم — اكتملت رسالتها"
                : `سلسلة ${toLatinDigits(String(seriesIndex + 1).padStart(2, "0"))} من ${toLatinDigits(SERIES.length)}`}
            </p>
            <h1>{series.name}{series.archived && <span className="series-archived-badge">أرشيف</span>}</h1>
            <p className="hub-desc">{series.description}</p>
            <p className="hub-count">{toLatinDigits(stories.length)} مادة منشورة</p>
          </div>
          <span className="series-detail-mark latin-number" dir="ltr" lang="en" aria-hidden="true">
            {toLatinDigits(String(seriesIndex + 1).padStart(2, "0"))}
          </span>
        </section>

        <nav className="series-switch" aria-label="السلاسل الأخرى">
          <Link href="/series">كل السلاسل</Link>
          {SERIES.map((item) => (
            <Link
              key={item.slug}
              href={`/series/${item.slug}`}
              className={item.slug === series.slug ? "is-active" : undefined}
              style={{ "--sc": item.color } as React.CSSProperties}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="wrap">
          {stories.length > 0 ? (
            <div className="series-feed">
              {stories.map((story, index) => (
                <MosaicCard
                  key={story.id}
                  story={story}
                  tall={index === 0}
                  className={index === 0 ? "series-lead" : undefined}
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">مواد هذه السلسلة في الطريق.</p>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
