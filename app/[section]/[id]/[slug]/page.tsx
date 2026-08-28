import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { JakStory } from "@/app/_components/jak-slides";
import { JakReport } from "@/app/_components/jak-report";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import {
  ArticleClosingPoll,
  ArticleToolbar,
  ArticleTracker,
  PersonalizedRelated,
} from "@/app/_components/article-experience";
import { brandDate, formatReadingBrief, toLatinDigits } from "@/lib/format";
import { looksLikeHtml, sanitizeBodyHtml } from "@/lib/content/html";
import { listPublicSlides, listRecent, sectionName, seedContentProvider, seriesOf } from "@/lib/content/provider";
import { isLandscapeReport, type JakSlide, type SlideData, type SlideType } from "@/lib/tahrir/jak";
import { storyHref } from "@/lib/content/types";
import { toRelatedCard } from "@/lib/personalization/recommend";
import { fetchEpisodes, podcastShowFor } from "@/lib/podcasts";
import { PodcastPlayer } from "@/app/_components/podcast-player";
import "@/app/_components/podcast-player.css";
import { InfographicLightbox } from "@/app/_components/infographic-lightbox";

export const revalidate = 300;
/** الأرشيف 29 ألف مادة: يُبنى مسبقًا أحدثها فقط والبقية ISR عند الطلب. */
export const dynamicParams = true;

type Params = { params: Promise<{ section: string; id: string; slug: string }> };

/** الفكّ الآمن لمعامل مسار قد يصل مرمّزًا أو مفكوكًا بحسب العميل. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function generateStaticParams() {
  const stories = await listRecent(150);
  return stories.map((story) => ({
    section: story.section,
    id: story.id,
    slug: story.slug,
  }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const story = await seedContentProvider.getStory(id);
  if (!story) return { title: "المادة غير موجودة" };

  const seoTitle = story.seoTitle || story.title;
  const seoDescription = story.seoDescription || story.excerpt;
  return {
    title: seoTitle,
    description: seoDescription,
    keywords: story.keywords?.length ? story.keywords : undefined,
    // canonical واحد دائمًا من الرابط المحفوظ — لا يعكس معاملات طلب غير قانونية.
    alternates: { canonical: storyHref(story) },
    openGraph: {
      type: "article",
      title: seoTitle,
      description: seoDescription,
      images: story.image ? [{ url: story.image }] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { id, section, slug } = await params;
  const story = await seedContentProvider.getStory(id);
  if (!story) notFound();

  // حارس canonical (شرط الهجرة): المعرّف يحسم — أي قسم أو سلاج مخالف للرابط المحفوظ
  // يتحول تحويلًا دائمًا (308) إليه، فلا يوجد 200 على بدائل ولا canonical متعارض.
  if (safeDecode(section) !== story.section || safeDecode(slug) !== story.slug) {
    // ترويسة Location لا تقبل غير ASCII — الرابط العربي يُرمّز وإلا رد الخادم 500.
    permanentRedirect(encodeURI(storyHref(story)));
  }

  const series = seriesOf(story);
  const related = await seedContentProvider.listRelated(story, 3);

  // برنامج بودكاست: حلقاته من خلاصة RSS المصدرية نفسها التي يقرأ منها الموقع القديم.
  const podcastShow = story.format === "podcasts" ? podcastShowFor(story.id) : undefined;
  const episodes = podcastShow ? await fetchEpisodes(podcastShow) : [];

  // «جاك العلم»: نفس الرابط المقدس، قالب قراءة غامر مختلف كليًا.
  if (story.format === "jakalelm") {
    const slideRows = await listPublicSlides(story.id);
    const slides: JakSlide[] = slideRows.map((row) => ({
      id: row.id,
      type: row.type as SlideType,
      title: row.title,
      body: row.body,
      stat: row.stat,
      statLabel: row.statLabel,
      image: row.image,
      imageStyle: row.imageStyle,
      imagePrompt: row.imagePrompt,
      sourceContext: row.sourceContext,
      hidden: row.hidden === 1,
      data: (row.data as SlideData) ?? null,
    }));
    const nextStory = related[0];

    return (
      <>
        <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
        <SiteHeader />
        {!isLandscapeReport(slides) && (
          /* الالتقاط المرن على تمرير الصفحة — proximity لا يحبس القارئ */
          <style>{`html{scroll-snap-type:y proximity}`}</style>
        )}
        <main id="main-content">
          {isLandscapeReport(slides) ? (
            <JakReport
              meta={{ title: story.title, sectionName: sectionName(story.section) }}
              slides={slides}
            />
          ) : (
            <JakStory
              meta={{
                title: story.title,
                sectionName: sectionName(story.section),
                readingMinutes: story.readingMinutes,
                shareUrl: `https://alelm.net${storyHref(story)}`,
                next: nextStory ? { title: nextStory.title, href: storyHref(nextStory) } : null,
              }}
              slides={slides}
            />
          )}
        </main>
        <SiteFooter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              headline: story.title,
              description: story.seoDescription || story.excerpt,
              keywords: story.keywords?.length ? story.keywords.join(", ") : undefined,
              datePublished: story.publishedAt,
              articleSection: sectionName(story.section),
              image: story.image ? [story.image] : undefined,
              publisher: { "@type": "Organization", name: "العلم", url: "https://alelm.net" },
            }).replace(/</g, "\\u003c"),
          }}
        />
        <link rel="canonical" href={`https://alelm.net${storyHref(story)}`} />
      </>
    );
  }
  const nextInSeries = series
    ? related.find((item) => item.series === series.slug)
    : undefined;
  const published = story.publishedAt ? new Date(story.publishedAt) : null;
  const readingBrief = formatReadingBrief(story.excerpt);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: story.title,
    description: story.seoDescription || story.excerpt,
    keywords: story.keywords?.length ? story.keywords.join(", ") : undefined,
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

        <article data-story-id={story.id}>
          <header className="article-head">
            {series ? (
              <Link
                className="series-chip"
                href={`/series/${series.slug}`}
                style={{ "--sc": series.color } as React.CSSProperties}
              >
                {series.name}
              </Link>
            ) : null}
            <h1>{story.title}</h1>
            <div className="article-meta">
              <span>{sectionName(story.section)}</span>
              {published && story.publishedAt ? (
                <time dateTime={story.publishedAt}>
                  {brandDate(story.publishedAt).hijri} — {brandDate(story.publishedAt).gregorian}
                </time>
              ) : null}
              <span>{toLatinDigits(story.readingMinutes)} دقائق قراءة</span>
              <span>تحرير: فريق العلم</span>
            </div>
          </header>

          {readingBrief ? (
            <aside className="article-brief" aria-labelledby="article-brief-label">
              <p id="article-brief-label" className="article-brief-label">قبل القراءة</p>
              <p className="article-brief-text">{readingBrief}</p>
            </aside>
          ) : null}

          <ArticleToolbar
            storyId={story.id}
            joinHref={`/join?next=${encodeURIComponent(storyHref(story))}`}
            excerpt={story.excerpt}
          />
          <ArticleTracker storyId={story.id} />

          {story.image ? (
            story.section === "infographics" ||
            story.format === "infographics" ||
            story.format === "infographic" ||
            story.title.includes("إنفوجرافيك") ? (
              <InfographicLightbox src={story.image} title={story.title} />
            ) : (
              <figure className="article-figure">
                <Image
                  src={story.image}
                  alt=""
                  fill
                  sizes="(max-width: 900px) 100vw, 860px"
                  priority
                />
              </figure>
            )
          ) : null}

          <div className="article-body" id="article-body">
            {story.body && looksLikeHtml(story.body) ? (
              // متن محرر اللوحة الغني — يُنقّى عند العرض أيضًا؛ القاعدة ليست مصدر ثقة.
              <div dangerouslySetInnerHTML={{ __html: sanitizeBodyHtml(story.body) }} />
            ) : story.body ? (
              story.body
                .split(/\n{2,}/)
                .filter((paragraph) => paragraph.trim())
                .map((paragraph, index) => <p key={index}>{paragraph.trim()}</p>)
            ) : story.excerpt ? null : (
              <p className="article-placeholder">متن هذه المادة غير متاح الآن.</p>
            )}

            {story.factCheck ? (
              <div className="fact-block">
                <div className="fact-rumor">
                  <b>✕ الشائعة</b>
                  <p>{story.factCheck.rumor}</p>
                </div>
                <div className="fact-truth">
                  <b>✓ الحقيقة</b>
                  <p>{story.factCheck.truth}</p>
                </div>
              </div>
            ) : null}
          </div>

          {podcastShow ? (
            episodes.length > 0 ? (
              <PodcastPlayer
                showName={podcastShow.name}
                accent={podcastShow.accent}
                youtube={podcastShow.youtube}
                episodes={episodes.map(({ title, audioUrl, publishedAt, duration, description, episode }) => ({
                  title, audioUrl, publishedAt, duration, description, episode,
                }))}
                dateLabels={episodes.map((episode) =>
                  episode.publishedAt ? brandDate(episode.publishedAt).gregorian : "",
                )}
              />
            ) : (
              <section className="ai-surface" style={{ marginTop: 26 }} aria-label="حلقات البرنامج">
                <p style={{ margin: 0, lineHeight: 1.9 }}>
                  حلقات {podcastShow.name} تُبث عبر{" "}
                  <a href={podcastShow.youtube} rel="noopener noreferrer" target="_blank">
                    قناة العلم في يوتيوب ←
                  </a>
                </p>
              </section>
            )
          ) : null}

          <ArticleClosingPoll
            storyId={story.id}
            question="هل غيّرت هذه المادة فهمك للموضوع؟"
            options={[
              { label: "نعم، أضافت لي سياقًا جديدًا" },
              { label: "كنت أعرف أغلب ما فيها" },
            ]}
          />

          {series ? (
            <aside className="series-note" style={{ "--sc": series.color } as React.CSSProperties}>
              <div className="series-note-copy">
                <p className="sn-kick">أنت تقرأ ضمن سلسلة</p>
                <h2>{series.name}</h2>
                <p className="sn-desc">{series.description}</p>
                <Link href={`/series/${series.slug}`}>تصفح السلسلة كاملة ←</Link>
              </div>
              {nextInSeries ? (
                <Link className="series-next" href={storyHref(nextInSeries)}>
                  <span>أكمل الفهم</span>
                  <b>{nextInSeries.title}</b>
                  <small>{toLatinDigits(nextInSeries.readingMinutes)} دقائق قراءة ←</small>
                </Link>
              ) : null}
            </aside>
          ) : null}
        </article>

        <PersonalizedRelated storyId={story.id} fallback={related.map((item) => toRelatedCard(item))} />
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
