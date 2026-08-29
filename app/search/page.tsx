import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { toLatinDigits } from "@/lib/format";
import { MosaicCard } from "@/app/_components/story-card";
import { Pagination } from "@/app/_components/pagination";
import { paginate } from "@/lib/content/pagination";
import { seedContentProvider } from "@/lib/content/provider";

export const metadata: Metadata = {
  title: "اسأل العلم — البحث",
  description: "ابحث في مواد العلم وسلاسله.",
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<{ q?: string; p?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q, p } = await searchParams;
  const query = (q ?? "").trim();
  const allResults = query ? await seedContentProvider.search(query) : [];
  const { items: results, page, pageCount, total, from, to } = paginate(allResults, p);

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />

      <main id="main-content">
        <section className="hub-hero search-hero">
          <div className="hub-hero-copy search-hero-copy">
            <p className="eyebrow">اسأل العلم</p>
            <h1>{query ? `نتائج «${query}»` : "ماذا تريد أن تعرف؟"}</h1>
            <form className="ask-form search-hero-form" action="/search" role="search">
              <span className="spark" aria-hidden="true">✦</span>
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="اكتب سؤالًا أو موضوعًا"
                aria-label="ابحث في العلم"
                dir="rtl"
              />
              <button type="submit">ابحث</button>
            </form>
            {!query ? (
              <div className="ask-foot">
                <span>جرّب:</span>
                <div className="sugg">
                  <Link href="/search?q=التنجستن">أسعار التنجستن</Link>
                  <Link href="/search?q=غينيس">أرقام غينيس القياسية</Link>
                  <Link href="/search?q=الرياض">أحداث الرياض</Link>
                </div>
              </div>
            ) : null}
          </div>
          <p className="hub-count">
            {query
              ? pageCount > 1
                ? `${toLatinDigits(total)} نتيجة · عرض ${toLatinDigits(from)}–${toLatinDigits(to)} · صفحة ${toLatinDigits(page)} من ${toLatinDigits(pageCount)}`
                : `${toLatinDigits(total)} نتيجة — البحث يتجاهل التشكيل واختلاف الهمزات`
              : "بحث واحد في المواد والسلاسل والموضوعات"}
          </p>
        </section>

        <div className="wrap">
          {results.length > 0 ? (
            <>
              <div className="grid-3">
                {results.map((story) => (
                  <MosaicCard key={story.id} story={story} />
                ))}
              </div>
              <Pagination basePath="/search" page={page} pageCount={pageCount} extra={{ q: query }} />
            </>
          ) : null}

          {query && total === 0 ? (
            <p className="empty-state">لا نتائج مطابقة. جرّب كلمة أعم أو تصفّح السلاسل.</p>
          ) : null}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
