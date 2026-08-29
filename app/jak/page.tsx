import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { MosaicCard } from "@/app/_components/story-card";
import { listByFormat } from "@/lib/content/provider";
import { toLatinDigits } from "@/lib/format";

/** جاك العلم — الملفات الكبرى بقالب القراءة الغامر؛ دليلها العام. */

export const revalidate = 300;

export const metadata: Metadata = {
  title: "جاك العلم",
  description: "ملفات كبرى تشكل العالم، نحللها ونضعها في سياقها التاريخي بقالب قراءة غامر.",
  alternates: { canonical: "/jak" },
};

export default async function JakIndexPage() {
  const stories = await listByFormat("jakalelm", 36);

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader active="/jak" />

      <main id="main-content" className="wrap sx-page">
        <section className="hub-hero" style={{ margin: "0 0 24px", "--sc": "#12284b" } as React.CSSProperties}>
          <div className="hub-hero-copy">
            <p className="eyebrow">جاك العلم</p>
            <h1>ملفات كبرى تشكّل العالم</h1>
            <p className="hub-tagline">نحللها، ونضعها في سياقها التاريخي، ونقدّمها بقالب قراءة غامر.</p>
          </div>
          <p className="hub-count">{stories.length > 0 ? `${toLatinDigits(stories.length)} ملفًا` : "الملفات في الطريق"}</p>
        </section>

        {stories.length > 0 ? (
          <div className="grid-3 sx-grid" style={{ marginTop: 0 }}>
            {stories.map((story) => (
              <MosaicCard key={story.id} story={story} />
            ))}
          </div>
        ) : (
          <p className="empty-state">ملفات جاك العلم في الطريق.</p>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
