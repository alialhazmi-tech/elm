import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { StoryCard } from "@/app/_components/story-card";
import { getHomeBundle } from "@/lib/content/home";
import { seedContentProvider, seriesOf } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "العلم | المعرفة وراء الخبر",
  description:
    "منصة إعلام ومعرفة سعودية تشرح ما وراء الخبر عبر السلاسل والبيانات والفيديو والبودكاست.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const bundle = await getHomeBundle(seedContentProvider);
  const hero = bundle.hero;
  const heroSeries = seriesOf(hero);

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "العلم",
    url: "https://alelm.net",
    description: "منصة إعلام ومعرفة سعودية",
  };

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />

      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="hero-title" data-story-id={hero.id}>
          <div className="hero-copy">
            <p className="eyebrow"><span />{heroSeries ? `سلسلة ${heroSeries.name}` : hero.eyebrow}</p>
            <h1 id="hero-title">
              <Link href={storyHref(hero)}>{hero.title}</Link>
            </h1>
            <p className="hero-deck">{hero.excerpt}</p>
            <div className="hero-meta">
              <span>{hero.readingMinutes} دقائق قراءة</span>
              <span>{hero.eyebrow}</span>
            </div>
          </div>
          <div className="hero-visual">
            {hero.image ? (
              <Image
                className="hero-image"
                src={hero.image}
                alt=""
                fill
                sizes="(max-width: 900px) 100vw, 55vw"
                priority
              />
            ) : null}
            <div className="visual-grid" aria-hidden="true" />
          </div>
        </section>

        <section className="series-rail" id="series" aria-labelledby="series-title">
          <div className="section-heading compact">
            <div>
              <p>منتجات العلم</p>
              <h2 id="series-title">تسع سلاسل، تسع طرق للفهم</h2>
            </div>
            <span>اسحب لاكتشاف المزيد</span>
          </div>
          <div className="series-list" role="list">
            {bundle.series.map((item, index) => (
              <Link
                className="series-chip"
                key={item.slug}
                role="listitem"
                href={`/series/${item.slug}`}
                style={{ "--series-color": item.color } as React.CSSProperties}
              >
                <span className="series-index">{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <div className="content-shell" id="content">
          {bundle.sections.map((section, sectionIndex) => (
            <section className="content-section" key={section.key} aria-labelledby={`${section.key}-title`}>
              <div className="section-heading">
                <div>
                  <p>{section.kicker}</p>
                  <h2 id={`${section.key}-title`}>{section.title}</h2>
                </div>
                <span className="section-number">0{sectionIndex + 1}</span>
              </div>
              <div className="story-grid">
                {section.stories.map((story, index) => (
                  <StoryCard key={story.id} story={story} index={index + sectionIndex} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="newsletter" aria-labelledby="newsletter-title">
          <div>
            <p>رسالة واحدة، معنى أوضح</p>
            <h2 id="newsletter-title">المعرفة التي تستحق وقتك</h2>
          </div>
          <p>ملخص أسبوعي للسلاسل وما وراء الخبر. لا ضوضاء، ولا سباق تنبيهات.</p>
          <span className="newsletter-status">صفحة الاشتراك ضمن M3</span>
        </section>
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
