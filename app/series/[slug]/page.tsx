import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pagination } from "@/app/_components/pagination";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { MosaicCard } from "@/app/_components/story-card";
import { ALL_SERIES, pageBySeries, sectionName, SERIES, seedContentProvider } from "@/lib/content/provider";
import { headlineStat } from "@/lib/content/headline-stat";
import { storyHref } from "@/lib/content/types";
import { formatReadingMinutes, relativeTimeAr, toLatinDigits } from "@/lib/format";

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
  const basePath = `/series/${series.slug}`;
  const seriesStyle = { "--sc": series.color } as React.CSSProperties;

  // الصفحة الأولى: أحدث مادة تتصدر لوحة السلسلة، والبقية شبكة.
  const lead = page === 1 ? items[0] : undefined;
  const grid = lead ? items.slice(1) : items;
  const leadWhen = lead ? relativeTimeAr(lead.publishedAt) : null;

  const countLine =
    total === 0
      ? "لا مواد منشورة بعد"
      : pageCount > 1
        ? `${toLatinDigits(total)} مادة · عرض ${toLatinDigits(from)}–${toLatinDigits(to)} · صفحة ${toLatinDigits(page)} من ${toLatinDigits(pageCount)}`
        : `${toLatinDigits(total)} مادة منشورة`;

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader active="/series" activeSeries={series.slug} />

      <main id="main-content" className="wrap sx-page" style={seriesStyle}>
        <nav className="sx-switch" aria-label="السلاسل">
          <Link href="/series" className="sx-all">كل السلاسل</Link>
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

        <section className={`sx-hero${lead?.image ? "" : " no-media"}`} aria-label={`سلسلة ${series.name}`}>
          <div className="sx-hero-copy">
            <div className="sx-hero-top">
              <span className="kick">
                {series.archived ? "من أرشيف العلم" : "سلسلة"}
                <span className="sect">· {series.description}</span>
              </span>
              <h1>{series.name}</h1>
              <p className="meta">{countLine}</p>
            </div>
            {lead ? (
              <div className="sx-lead" data-story-id={lead.id}>
                <span className="meta">أحدث مادة · {sectionName(lead.section)}</span>
                <h2><Link className="story-link" href={storyHref(lead)}>{lead.title}</Link></h2>
                {lead.excerpt ? <p>{lead.excerpt.slice(0, 160)}{lead.excerpt.length > 160 ? "…" : ""}</p> : null}
                <div className="sx-lead-actions">
                  <Link className="btn-pill" href={storyHref(lead)}>اقرأ المادة</Link>
                  <span className="meta">
                    قراءة {formatReadingMinutes(lead.readingMinutes)}
                    {leadWhen ? ` · ${leadWhen}` : ""}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
          {lead?.image ? (
            <Link className="sx-hero-media soft-img" href={storyHref(lead)} aria-hidden="true" tabIndex={-1}>
              <Image src={lead.image} alt="" fill sizes="(max-width: 1040px) 100vw, 560px" priority />
            </Link>
          ) : null}
        </section>

        {grid.length > 0 ? (
          <>
            <div className="grid-3 sx-grid">
              {grid.map((story) => (
                <MosaicCard key={story.id} story={story} stat={headlineStat(story.title)} />
              ))}
            </div>
            <Pagination basePath={basePath} page={page} pageCount={pageCount} />
          </>
        ) : items.length === 0 ? (
          <p className="empty-state">مواد هذه السلسلة في الطريق.</p>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
