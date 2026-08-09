import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
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

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader active="/series/absat" />

      <main id="main-content">
        <section className="hub-hero" style={{ "--sc": series.color } as React.CSSProperties}>
          <p className="eyebrow">سلسلة من طيف العلم</p>
          <h1>{series.name}</h1>
          <p className="hub-desc">{series.description}</p>
          <p className="hub-count">{stories.length} مادة منشورة</p>
        </section>

        <nav className="series-switch" aria-label="السلاسل الأخرى">
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
            <div className="grid-3">
              {stories.map((story) => (
                <MosaicCard key={story.id} story={story} />
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
