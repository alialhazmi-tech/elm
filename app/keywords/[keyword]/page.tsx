import type { Metadata } from "next";
import { sharingMetadata } from "@/lib/sharing";
import { cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { MosaicCard } from "@/app/_components/story-card";
import { Pagination } from "@/app/_components/pagination";
import { pageByKeyword } from "@/lib/content/provider";
import { decodeKeywordParam, keywordHref } from "@/lib/content/keywords";
import { pageHref, parsePage } from "@/lib/content/pagination";
import { toLatinDigits } from "@/lib/format";

export const revalidate = 120;
type Props = {
  params: Promise<{ keyword: string }>;
  searchParams: Promise<{ p?: string }>;
};
const loadPage = cache(pageByKeyword);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { keyword: raw } = await params;
  const keyword = decodeKeywordParam(raw).trim();
  const { p } = await searchParams;
  if (!keyword) return { title: "الكلمة المفتاحية غير موجودة", robots: { index: false } };
  const { total, page } = await loadPage(keyword, p);
  const title = `${keyword}${page > 1 ? ` — صفحة ${page}` : ""}`;
  const description = `أخبار ومواد العلم المنشورة تحت الكلمة المفتاحية «${keyword}»، مرتبة من الأحدث.`;
  return {
    title, description,
    alternates: { canonical: pageHref(keywordHref(keyword), page) },
    robots: { index: total > 0, follow: true },
    ...sharingMetadata({ title, description, path: pageHref(keywordHref(keyword), page) }),
  };
}

export default async function KeywordPage({ params, searchParams }: Props) {
  const { keyword: raw } = await params;
  const decoded = decodeKeywordParam(raw);
  const keyword = decoded.trim();
  const { p } = await searchParams;
  if (!keyword) notFound();
  const { items, total, page, pageCount, from, to } = await loadPage(keyword, p);
  const basePath = keywordHref(keyword);
  if (decoded !== keyword || parsePage(p) !== page) permanentRedirect(pageHref(basePath, page));
  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />
      <main id="main-content" className="wrap keyword-page" dir="rtl">
        <header className="keyword-hero">
          <nav className="breadcrumb" aria-label="مسار التصفح"><Link href="/">الرئيسية</Link><span aria-hidden="true">·</span><span>الكلمات المفتاحية</span></nav>
          <p className="eyebrow">أرشيف الكلمة المفتاحية</p>
          <h1>{keyword}</h1>
          <p>أخبار ومواد مرتبطة بهذه الكلمة، من الأحدث إلى الأقدم.</p>
          <p className="meta">{toLatinDigits(total)} مادة{pageCount > 1 ? ` · عرض ${toLatinDigits(from)}–${toLatinDigits(to)} · صفحة ${toLatinDigits(page)} من ${toLatinDigits(pageCount)}` : ""}</p>
        </header>
        {items.length ? (
          <>
            <div className="grid-3">{items.map((story) => <MosaicCard key={story.id} story={story} />)}</div>
            <Pagination basePath={basePath} page={page} pageCount={pageCount} />
          </>
        ) : (
          <div className="empty-state"><p>لا توجد مواد منشورة بهذه الكلمة حاليًا.</p><Link href={`/search?q=${encodeURIComponent(keyword)}`}>ابحث عن «{keyword}» في الأرشيف ←</Link></div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
