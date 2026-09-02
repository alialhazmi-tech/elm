import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { JakStory } from "@/app/_components/jak-slides";
import { JakReport } from "@/app/_components/jak-report";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import {
  ArticleClosingPoll,
  ArticleSaveButton,
  ArticleToolbar,
  ArticleTracker,
  PersonalizedRelated,
} from "@/app/_components/article-experience";
import { ReadingProgress } from "@/app/_components/reading-progress";
import { videoEmbedUrl } from "@/lib/content/video";
import { brandDate, formatArticleDek, formatReadingBrief, formatReadingMinutes, toLatinDigits } from "@/lib/format";
import { looksLikeHtml, sanitizeBodyHtml } from "@/lib/content/html";
import { listPublicSlides, listRecent, sectionName, seedContentProvider, seriesOf } from "@/lib/content/provider";
import { isLandscapeReport, type JakSlide, type SlideData, type SlideType } from "@/lib/tahrir/jak";
import { storyHref } from "@/lib/content/types";
import { toRelatedCard } from "@/lib/personalization/recommend";
import { fetchEpisodes, formatPodcastDuration, podcastShowFor, presentEpisode } from "@/lib/podcasts";
import { PodcastPlayer } from "@/app/_components/podcast-player";
import { PodcastHeroPlay } from "@/app/_components/podcast-hero";
import { ArticleInsights } from "@/app/_components/article-insights";
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
  const related = await seedContentProvider.listRelated(story, 6);

  // برنامج بودكاست: حلقاته من خلاصة RSS المصدرية نفسها التي يقرأ منها الموقع القديم.
  const podcastShow = story.format === "podcasts" ? podcastShowFor(story.id) : undefined;
  const episodes = podcastShow ? await fetchEpisodes(podcastShow) : [];
  const latestEpisode =
    podcastShow && episodes[0]
      ? (() => {
          const presented = presentEpisode(episodes[0].title, podcastShow.name, episodes[0].description);
          return { title: presented.title, guest: presented.guest, audioUrl: episodes[0].audioUrl };
        })()
      : null;

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
  const published = story.publishedAt ? new Date(story.publishedAt) : null;
  const readingBrief = formatReadingBrief(story.excerpt);
  const isInfographicStory =
    story.section === "infographics" ||
    story.format === "infographics" ||
    story.format === "infographic" ||
    story.title.includes("إنفوجرافيك");
  // تحت العنوان: الجملة الأولى (الخلاصة). صندوق «قبل القراءة» يظهر فقط حين يضيف الموجز الكامل شيئًا يُذكر.
  const dek = readingBrief;
  const fullExcerpt = formatArticleDek(story.excerpt);
  // مواد الفيديو: المشغّل يحل محل الصورة البارزة في الرأس (الصورة تبقى للبطاقات والمشاركة).
  const videoEmbed = story.format === "videos" ? videoEmbedUrl(story.videoUrl) : null;
  const showBrief = fullExcerpt.length > readingBrief.length + 80;
  // الجانب: التالي في السلسلة نفسها (حتى 3)، والذيل: مواد من سلاسل أخرى.
  const sameSeries = series ? related.filter((item) => item.series === series.slug).slice(0, 3) : [];
  const otherSeries = related.filter((item) => !sameSeries.includes(item));
  const joinHref = `/join?next=${encodeURIComponent(storyHref(story))}`;

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
      {!podcastShow ? <ReadingProgress /> : null}

      <main id="main-content" className="article-shell">
        {series && !podcastShow ? (
          <div className="sa-strip" style={{ "--sc": series.color } as React.CSSProperties}>
            <span className="sn">أنت تقرأ ضمن سلسلة «{series.name}» — {series.description}</span>
            <Link href={`/series/${series.slug}`}>تصفح السلسلة ←</Link>
          </div>
        ) : null}

        <article data-story-id={story.id}>
          {podcastShow ? (
            <header className="pc-hero podcast-show" style={{ "--pc": podcastShow.accent } as React.CSSProperties}>
              <div className="pc-hero-cover">
                {story.image ? <Image src={story.image} alt="" fill sizes="(max-width: 640px) 160px, 260px" priority /> : null}
              </div>
              <div className="pc-hero-copy">
                <span className="pc-kicker">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
                  </svg>
                  <Link href="/podcasts">بودكاست العلم</Link>
                </span>
                <h1>{podcastShow.name}</h1>
                {story.excerpt ? <p className="pc-hero-desc">{story.excerpt}</p> : null}
                <p className="pc-hero-meta">
                  {episodes.length > 0 ? `${toLatinDigits(episodes.length)} حلقة` : "الحلقات على يوتيوب"}
                  {published && story.publishedAt ? (
                    <>
                      <span aria-hidden="true"> · </span>
                      منذ <time dateTime={story.publishedAt}>{brandDate(story.publishedAt).gregorian}</time>
                    </>
                  ) : null}
                </p>
                <div className="pc-hero-actions">
                  <PodcastHeroPlay
                    showName={podcastShow.name}
                    accent={podcastShow.accent}
                    episode={latestEpisode}
                  />
                  <a className="pc-yt" href={podcastShow.youtube} rel="noopener noreferrer" target="_blank">يوتيوب ←</a>
                </div>
              </div>
            </header>
          ) : (
            <header className={`sa-head${(isInfographicStory || !story.image) && !videoEmbed ? " no-media" : ""}`}>
              <div className="sa-head-copy">
                <div className="sa-head-top">
                  <nav className="breadcrumb" aria-label="مسار التصفح">
                    <Link href="/">الرئيسية</Link>
                    <span aria-hidden="true">·</span>
                    <Link href={`/${story.section}`}>{sectionName(story.section)}</Link>
                    {series ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <Link href={`/series/${series.slug}`}>{series.name}</Link>
                      </>
                    ) : null}
                  </nav>
                  <h1>{story.title}</h1>
                  {dek ? <p className="sa-dek">{dek}</p> : null}
                </div>
                <div className="sa-head-bottom">
                  <div className="sa-byline">
                    <span className="sa-avatar" aria-hidden="true">ع</span>
                    <div>
                      <b>فريق العلم</b>
                      <span className="meta">
                        {published && story.publishedAt ? (
                          <time dateTime={story.publishedAt}>{brandDate(story.publishedAt).gregorian}</time>
                        ) : null}
                        {published ? " · " : ""}
                        قراءة {formatReadingMinutes(story.readingMinutes)}
                      </span>
                    </div>
                  </div>
                  <ArticleSaveButton storyId={story.id} joinHref={joinHref} />
                </div>
              </div>
              {videoEmbed ? (
                <figure className="sa-media sa-video">
                  <iframe
                    src={videoEmbed}
                    title={story.title}
                    loading="lazy"
                    allow="accelerometer; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    style={{ aspectRatio: "16 / 9", width: "100%", border: 0, display: "block", background: "#000" }}
                  />
                </figure>
              ) : story.image && !isInfographicStory ? (
                <figure className="sa-media">
                  <div className="soft-img">
                    <Image
                      src={story.image}
                      alt=""
                      fill
                      sizes="(max-width: 1040px) 100vw, 600px"
                      priority
                    />
                  </div>
                </figure>
              ) : null}
            </header>
          )}

          <ArticleTracker storyId={story.id} />

          {!podcastShow && story.image && isInfographicStory ? (
            <InfographicLightbox src={story.image} title={story.title} />
          ) : null}

          {!podcastShow ? (
            <div className="sa-layout">
              <div className="sa-body">
                {showBrief ? (
                  <aside className="article-brief" aria-labelledby="article-brief-label">
                    <p id="article-brief-label" className="article-brief-label">قبل القراءة — الخلاصة في 30 ثانية</p>
                    <p className="article-brief-text">{fullExcerpt}</p>
                    <p className="article-brief-foot">من موجز المادة المنشورة</p>
                  </aside>
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

                <div className="sa-poll">
                  <ArticleClosingPoll
                    storyId={story.id}
                    question="هل غيّرت هذه المادة فهمك للموضوع؟"
                    options={[
                      { label: "نعم، أضافت لي سياقًا جديدًا" },
                      { label: "كنت أعرف أغلب ما فيها" },
                    ]}
                  />
                </div>
              </div>

              <aside className="sa-aside" aria-label="أدوات المادة">
                <ArticleToolbar storyId={story.id} joinHref={joinHref} excerpt={story.excerpt} />

                <ArticleInsights storyId={story.id} readingMinutes={story.readingMinutes} />

                {series ? (
                  <div className="sa-next" style={{ "--sc": series.color } as React.CSSProperties}>
                    <span className="lbl">التالي في سلسلة «{series.name}»</span>
                    {sameSeries.map((item, index) => (
                      <Link key={item.id} href={storyHref(item)}>
                        {index === 0 && item.image ? (
                          <span className="soft-img">
                            <Image src={item.image} alt="" fill sizes="360px" />
                          </span>
                        ) : null}
                        <h3>{item.title}</h3>
                        <span className="meta">قراءة {formatReadingMinutes(item.readingMinutes)}</span>
                      </Link>
                    ))}
                    <Link className="all" href={`/series/${series.slug}`}>تصفح السلسلة كاملة ←</Link>
                  </div>
                ) : null}
              </aside>
            </div>
          ) : null}

          {podcastShow ? (
            episodes.length > 0 ? (
              <PodcastPlayer
                showName={podcastShow.name}
                accent={podcastShow.accent}
                youtube={podcastShow.youtube}
                episodes={episodes.map((episode) => {
                  const presented = presentEpisode(episode.title, podcastShow.name, episode.description);
                  return {
                    title: presented.title,
                    guest: presented.guest,
                    audioUrl: episode.audioUrl,
                    publishedAt: episode.publishedAt,
                    duration: formatPodcastDuration(episode.duration),
                    description: episode.description,
                    episode: episode.episode,
                  };
                })}
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
        </article>

        <div className="sa-related">
          <PersonalizedRelated
            storyId={story.id}
            fallback={otherSeries.map((item) =>
              toRelatedCard(item, {
                code: "section",
                text: `لأنك تقرأ في ${sectionName(story.section)}`,
              }),
            )}
          />
        </div>
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
