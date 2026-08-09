import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { StoryCard } from "@/app/_components/story-card";
import { sectionName, seedContentProvider, seriesOf } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";

export const revalidate = 300;

type Params = { params: Promise<{ section: string; id: string; slug: string }> };

export async function generateStaticParams() {
  const stories = await seedContentProvider.listAll();
  return stories.map((story) => ({
    section: story.section,
    id: story.id,
    slug: story.slug,
  }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, section, slug } = await params;
  const story = await seedContentProvider.getStory(id);
  if (!story) return { title: "المادة غير موجودة" };

  return {
    title: story.title,
    description: story.excerpt,
    alternates: { canonical: `/${section}/${id}/${slug}` },
    openGraph: {
      type: "article",
      title: story.title,
      description: story.excerpt,
      images: story.image ? [{ url: story.image }] : undefined,
    },
  };
}

// الأرقام الإنجليزية إلزامية وفق الدستور التحريري § 7 (nu-latn).
const DATE_FORMAT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function ArticlePage({ params }: Params) {
  const { id } = await params;
  const story = await seedContentProvider.getStory(id);
  if (!story) notFound();

  const series = seriesOf(story);
  const related = await seedContentProvider.listRelated(story, 3);
  const published = story.publishedAt ? new Date(story.publishedAt) : null;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: story.title,
    description: story.excerpt,
    datePublished: story.publishedAt,
    articleSection: sectionName(story.section),
    image: story.image ? [story.image] : undefined,
    publisher: { "@type": "Organization", name: "العلم", url: "https://alelm.net" },
  };

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />

      <main id="main-content" className="article-shell">
        <nav className="breadcrumb" aria-label="مسار التصفح">
          <Link href="/">الرئيسية</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/${story.section}`}>{sectionName(story.section)}</Link>
          {series ? (
            <>
              <span aria-hidden="true">/</span>
              <Link href={`/series/${series.slug}`}>{series.name}</Link>
            </>
          ) : null}
        </nav>

        <article className="article" data-story-id={story.id}>
          <header className="article-head">
            {series ? (
              <Link
                className="series-badge"
                href={`/series/${series.slug}`}
                style={{ "--series-color": series.color } as React.CSSProperties}
              >
                {series.name}
              </Link>
            ) : null}
            <h1>{story.title}</h1>
            <p className="article-deck">{story.excerpt}</p>
            <div className="article-meta">
              <span>{sectionName(story.section)}</span>
              {published ? <time dateTime={story.publishedAt}>{DATE_FORMAT.format(published)}</time> : null}
              <span>{story.readingMinutes} دقائق قراءة</span>
            </div>
          </header>

          {story.image ? (
            <figure className="article-figure">
              <Image
                src={story.image}
                alt=""
                fill
                sizes="(max-width: 900px) 100vw, 860px"
                priority
                className="article-image"
              />
            </figure>
          ) : null}

          <div className="article-body">
            <p>{story.excerpt}</p>
            <p className="article-placeholder">
              نص المادة الكامل يصل من مصدر المحتوى عند ربط محوّل WordPress ثم «تحرير العلم».
              هذه الصفحة تعرض القالب الحقيقي: المسار، السلسلة، الصورة، التاريخ، زمن القراءة،
              وبيانات NewsArticle المهيكلة.
            </p>
          </div>

          {series ? (
            <aside className="series-note" style={{ "--series-color": series.color } as React.CSSProperties}>
              <p>هذه المادة ضمن سلسلة</p>
              <h2>{series.name}</h2>
              <p className="series-note-desc">{series.description}</p>
              <Link href={`/series/${series.slug}`}>تصفح السلسلة</Link>
            </aside>
          ) : null}
        </article>

        {related.length > 0 ? (
          <section className="content-section" aria-labelledby="related-title">
            <div className="section-heading">
              <div>
                <p>لا تفوّت</p>
                <h2 id="related-title">مواد ذات صلة</h2>
              </div>
            </div>
            <div className="story-grid">
              {related.map((item, index) => (
                <StoryCard key={item.id} story={item} index={index} />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema).replace(/</g, "\\u003c") }}
      />
      <link rel="canonical" href={`https://alelm.net${storyHref(story)}`} />
    </>
  );
}
