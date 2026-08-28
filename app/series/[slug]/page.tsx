import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pagination } from "@/app/_components/pagination";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { MosaicCard } from "@/app/_components/story-card";
import { ALL_SERIES, pageBySeries, SERIES, seedContentProvider } from "@/lib/content/provider";
import { toLatinDigits } from "@/lib/format";

export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
};

export async function generateStaticParams() {
  // المتقاعدة تُبنى أيضًا — أرشيفها حي بقرار المالك.
  return ALL_SERIES.map((series) => ({ slug: series.slug }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { p } = await searchParams;
  const series = await seedContentProvider.getSeries(slug);
  if (!series) return { title: "السلسلة غير موجودة" };

  const page = Number.parseInt(p ?? "1", 10);
  const title =
    Number.isFinite(page) && page > 1
      ? `سلسلة ${series.name} — صفحة ${page}`
      : `سلسلة ${series.name}`;

  return {
    title,
    description: series.description,
    alternates: {
      canonical: page > 1 ? `/series/${series.slug}?p=${page}` : `/series/${series.slug}`,
    },
  };
}

export default async function SeriesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { p } = await searchParams;
  const series = await seedContentProvider.getSeries(slug);
  if (!series) notFound();

  // ترقيم في SQL — سلاسل الأرشيف تحمل آلاف المواد.
  const { items, page, pageCount, total, from, to } = await pageBySeries(series.slug, p);
  const seriesIndex = SERIES.findIndex((item) => item.slug === series.slug);
  const basePath = `/series/${series.slug}`;

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
            <h1>
              {series.name}
              {series.archived ? <span className="series-archived-badge">أرشيف</span> : null}
            </h1>
            <p className="hub-desc">{series.description}</p>
            <p className="hub-count">
              {total === 0
                ? "لا مواد منشورة بعد"
                : pageCount > 1
                  ? `${toLatinDigits(total)} مادة · عرض ${toLatinDigits(from)}–${toLatinDigits(to)} · صفحة ${toLatinDigits(page)} من ${toLatinDigits(pageCount)}`
                  : `${toLatinDigits(total)} مادة منشورة`}
            </p>
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
          {items.length > 0 ? (
            <>
              <div className="series-feed">
                {items.map((story, index) => (
                  <MosaicCard
                    key={story.id}
                    story={story}
                    tall={page === 1 && index === 0}
                    className={page === 1 && index === 0 ? "series-lead" : undefined}
                  />
                ))}
              </div>
              <Pagination basePath={basePath} page={page} pageCount={pageCount} />
            </>
          ) : (
            <p className="empty-state">مواد هذه السلسلة في الطريق.</p>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
