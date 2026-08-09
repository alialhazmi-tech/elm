import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { StoryCard } from "@/app/_components/story-card";
import { seedContentProvider } from "@/lib/content/provider";

export const metadata: Metadata = {
  title: "البحث",
  description: "ابحث في مواد العلم وسلاسلها.",
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
        <section className="section-hero">
          <p className="eyebrow"><span />بحث</p>
          <h1>{query ? `نتائج «${query}»` : "ابحث في العلم"}</h1>
          <p className="section-hero-count">
            {query
              ? `${results.length} نتيجة`
              : "اكتب كلمة في حقل البحث أعلى الصفحة — البحث يتجاهل التشكيل واختلاف الهمزات."}
          </p>
        </section>

        {results.length > 0 ? (
          <div className="content-shell">
            <section className="content-section">
              <div className="story-grid">
                {results.map((story, index) => (
                  <StoryCard key={story.id} story={story} index={index} />
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {query && results.length === 0 ? (
          <div className="content-shell">
            <p className="empty-state">لا نتائج مطابقة. جرّب كلمة أعم أو تصفّح السلاسل.</p>
          </div>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
