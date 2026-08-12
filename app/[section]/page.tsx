import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Pagination } from "@/app/_components/pagination";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { MosaicCard } from "@/app/_components/story-card";
import { paginate } from "@/lib/content/pagination";
import { KNOWN_SECTIONS, sectionName, seedContentProvider } from "@/lib/content/provider";
import { toLatinDigits } from "@/lib/format";

export const revalidate = 180;

type Props = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ p?: string }>;
};

export async function generateStaticParams() {
  return KNOWN_SECTIONS.map((section) => ({ section }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { section } = await params;
  const { p } = await searchParams;
  if (!KNOWN_SECTIONS.includes(section)) return { title: "القسم غير موجود" };

  const page = Number.parseInt(p ?? "1", 10);
  const title =
    Number.isFinite(page) && page > 1
      ? `${sectionName(section)} — صفحة ${page}`
      : sectionName(section);

  return {
    title,
    description: `أحدث مواد قسم ${sectionName(section)} في العلم.`,
    alternates: { canonical: page > 1 ? `/${section}?p=${page}` : `/${section}` },
  };
}

export default async function SectionPage({ params, searchParams }: Props) {
  const { section } = await params;
  const { p } = await searchParams;
  if (!KNOWN_SECTIONS.includes(section)) notFound();

  const all = await seedContentProvider.listBySection(section);
  const { items, page, pageCount, total, from, to } = paginate(all, p);
  const basePath = `/${section}`;

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader active={basePath} />

      <main id="main-content">
        <section className="hub-hero">
          <p className="eyebrow">قسم</p>
          <h1>{sectionName(section)}</h1>
          <p className="hub-count">
            {total === 0
              ? "لا مواد بعد"
              : pageCount > 1
                ? `${toLatinDigits(total)} مادة · عرض ${toLatinDigits(from)}–${toLatinDigits(to)} · صفحة ${toLatinDigits(page)} من ${toLatinDigits(pageCount)}`
                : `${toLatinDigits(total)} مادة`}
          </p>
        </section>

        <div className="wrap">
          {items.length > 0 ? (
            <>
              <div className="section-feed">
                {items.map((story, index) => (
                  <MosaicCard
                    key={story.id}
                    story={story}
                    tall={page === 1 && index === 0}
                    className={page === 1 && index === 0 ? "section-lead" : undefined}
                  />
                ))}
              </div>
              <Pagination basePath={basePath} page={page} pageCount={pageCount} />
            </>
          ) : (
            <p className="empty-state">لا مواد في هذا القسم بعد.</p>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
