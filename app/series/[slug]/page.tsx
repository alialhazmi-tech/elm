import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { toEasternDigits } from "@/lib/format";
import { MosaicCard } from "@/app/_components/story-card";
import { SERIES, seedContentProvider } from "@/lib/content/provider";

export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return SERIES.map((series) => ({ slug: series.slug }));
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
            <p className="eyebrow">سلسلة {toEasternDigits(String(seriesIndex + 1).padStart(2, "0"))} من {toEasternDigits(9)}</p>
            <h1>{series.name}</h1>
            <p className="hub-desc">{series.description}</p>
            <p className="hub-count">{toEasternDigits(stories.length)} مادة منشورة</p>
          </div>
          <span className="series-detail-mark" aria-hidden="true">
            {toEasternDigits(String(seriesIndex + 1).padStart(2, "0"))}
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
