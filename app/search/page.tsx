import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { toLatinDigits } from "@/lib/format";
import { MosaicCard } from "@/app/_components/story-card";
import { seedContentProvider } from "@/lib/content/provider";

export const metadata: Metadata = {
  title: "اسأل العلم — البحث",
  description: "ابحث في مواد العلم وسلاسله.",
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await seedContentProvider.search(query) : [];

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />

      <main id="main-content">
        <section className="hub-hero">
          <p className="eyebrow">اسأل العلم</p>
          <h1>{query ? `نتائج «${query}»` : "ابحث في العلم"}</h1>
          <p className="hub-count">
            {query
              ? `${toLatinDigits(results.length)} نتيجة — البحث يتجاهل التشكيل واختلاف الهمزات`
              : "اكتب سؤالك أو كلمتك — والإجابات الذكية بالإحالة للمصدر تصل مع مرحلة خدمات الذكاء"}
          </p>
        </section>

        <div className="wrap">
          <section className="ai-surface ask-block" style={{ marginTop: 0 }}>
            <form className="ask-form" action="/search" role="search">
              <span className="spark" aria-hidden="true">✦</span>
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="لماذا ترتفع أسعار التنجستن؟"
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
          </section>

          {results.length > 0 ? (
            <div className="grid-3">
              {results.map((story) => (
                <MosaicCard key={story.id} story={story} />
              ))}
            </div>
          ) : null}

          {query && results.length === 0 ? (
            <p className="empty-state">لا نتائج مطابقة. جرّب كلمة أعم أو تصفّح السلاسل.</p>
          ) : null}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
