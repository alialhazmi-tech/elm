import { ArticleLikeButton } from "@/app/_components/article-interactions";
import { PublicReadingTracker } from "@/app/_components/public-reading-tracker";
import type { Metadata } from "next";
import { sharingMetadata, sharingOrigin } from "@/lib/sharing";
import { publicShareUrl } from "@/lib/sharing-contract";
import Image from "next/image";
import { readingOutline } from "@/lib/content/reading-outline";
import Link from "next/link";
import { Link2, List } from "lucide-react";
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
import { BodyHtml } from "@/components/content/body-html";
import { VideoPlayer } from "@/components/content/video-player";
import { ReadingProgress } from "@/app/_components/reading-progress";
import { normalizeVideoUrl } from "@/lib/content/video";
import { formatArticleDek, formatArticleTimestamp, formatReadingMinutes } from "@/lib/format";
import { looksLikeHtml, sanitizeBodyHtml } from "@/lib/content/html";
import { responsiveBodyImages } from "@/lib/content/body-images";
import { listPublicSlides, listRecent, sectionName, seedContentProvider, seriesOf } from "@/lib/content/provider";
import { isLandscapeReport, type JakSlide, type SlideData, type SlideType } from "@/lib/tahrir/jak";
import { shortStoryHref, storyHref } from "@/lib/content/types";
import { isCanonicalStoryAlias, publicStoryId } from "@/lib/content/canonical-stories";
import { toRelatedCard } from "@/lib/personalization/recommend";
import { podcastShowForStory, showEpisodes } from "@/lib/podcast-catalog";
import { PodcastShowView } from "@/app/_components/podcast-show-view";
import { ArticleInsights } from "@/app/_components/article-insights";
import { ArticleKeywords } from "@/app/_components/article-keywords";
import "@/app/_components/podcast-player.css";
import { InfographicLightbox } from "@/app/_components/infographic-lightbox";
import { PublicBreadcrumbs } from "@/app/_components/public-breadcrumbs";
import { articleMetaDescription, cleanMetadataTitle } from "@/lib/seo/metadata";
import { articleStructuredData, PUBLIC_SITE_URL } from "@/lib/seo/schema";
import { imageFocusStyle } from "@/lib/content/image-focus";

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
  if (!story) return { title: "الخبر غير متاح", robots: { index: false, follow: true } };

  const seoTitle = cleanMetadataTitle(story.seoTitle, story.title);
  const seoDescription = articleMetaDescription(story);
  return {
    title: seoTitle,
    description: seoDescription,
    keywords: story.keywords?.length ? story.keywords : undefined,
    // canonical واحد دائمًا من الرابط المحفوظ — لا يعكس معاملات طلب غير قانونية.
    alternates: { canonical: storyHref(story) },
    ...sharingMetadata({ type: "article", title: story.title, description: seoDescription,
      path: storyHref(story), image: story.image, storyId: story.id, format: story.format, section: story.section, publishedTime: story.publishedAt }),
  };
}

export default async function ArticlePage({ params }: Params) {
  const { id, section, slug } = await params;
  const story = await seedContentProvider.getStory(id);
  if (!story) notFound();

  // حارس canonical (شرط الهجرة): المعرّف يحسم — أي قسم أو سلاج مخالف للرابط المحفوظ
  // يتحول تحويلًا دائمًا (308) إليه، فلا يوجد 200 على بدائل ولا canonical متعارض.
  // روابط UUID القديمة لمواد اللوحة تتحول بالطريقة نفسها إلى رقمها العام القصير.
  if (isCanonicalStoryAlias(story) || safeDecode(id) !== publicStoryId(story) || safeDecode(section) !== story.section || safeDecode(slug) !== story.slug) {
    // ترويسة Location لا تقبل غير ASCII — الرابط العربي يُرمّز وإلا رد الخادم 500.
    permanentRedirect(encodeURI(storyHref(story)));
  }

  const series = seriesOf(story);
  const related = await seedContentProvider.listRelated(story, 6);
  const canonicalPath = storyHref(story);
  const canonicalUrl = new URL(canonicalPath, PUBLIC_SITE_URL).href;
  const breadcrumbItems = [
    { label: "الرئيسية", href: "/" },
    { label: sectionName(story.section), href: `/${story.section}` },
    { label: story.title },
  ] as const;

  // برنامج بودكاست: حلقاته من خلاصة RSS المصدرية مع ما رُفع من اللوحة.
  const podcastShow = story.format === "podcasts" ? await podcastShowForStory(story.id) : undefined;
  const episodes = podcastShow ? await showEpisodes(podcastShow) : [];

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
        <PublicBreadcrumbs items={breadcrumbItems} />
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
                shareUrl: publicShareUrl(shortStoryHref(story), sharingOrigin()),
                next: nextStory ? { title: nextStory.title, href: storyHref(nextStory) } : null,
              }}
              slides={slides}
            />
          )}
          <div className="wrap"><ArticleKeywords keywords={story.keywords} /></div>
        </main>
        <SiteFooter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(articleStructuredData({
              story,
              canonicalUrl,
              sectionName: sectionName(story.section),
            })).replace(/</g, "\\u003c"),
          }}
        />
      </>
    );
  }
  const published = story.publishedAt ? new Date(story.publishedAt) : null;
  const publishedTimestamp = formatArticleTimestamp(story.publishedAt);
  const updatedTimestamp = story.updatedAt && story.publishedAt &&
    Date.parse(story.updatedAt) > Date.parse(story.publishedAt)
    ? formatArticleTimestamp(story.updatedAt) : null;
  const isInfographicStory =
    story.section === "infographics" ||
    story.format === "infographics" ||
    story.format === "infographic" ||
    story.title.includes("إنفوجرافيك");
  // الملخص التحريري كاملًا تحت العنوان، كما هو متاح للموجز الصوتي، دون حد كلمات أو حروف.
  const fullExcerpt = formatArticleDek(story.excerpt);
  // مواد الفيديو: المشغّل يحل محل الصورة البارزة في الرأس (الصورة تبقى للبطاقات والمشاركة).
  const videoUrl = story.format === "videos" ? normalizeVideoUrl(story.videoUrl) : null;
  // الجانب: التالي في السلسلة نفسها (حتى 3)، والذيل: مواد من سلاسل أخرى.
  const sameSeries = series ? related.filter((item) => item.series === series.slug).slice(0, 3) : [];
  const otherSeries = related.filter((item) => !sameSeries.includes(item));
  const joinHref = `/join?next=${encodeURIComponent(storyHref(story))}`;

  const reading = readingOutline(story.body && looksLikeHtml(story.body) ? sanitizeBodyHtml(story.body) : "");
  const articleSchema = articleStructuredData({
    story: { ...story, updatedAt: updatedTimestamp ? story.updatedAt : undefined },
    canonicalUrl,
    sectionName: sectionName(story.section),
    includeEditorialTeam: true,
  });

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />
      {!podcastShow ? <ReadingProgress /> : null}

      <main id="main-content" className="article-shell">
        <PublicBreadcrumbs items={breadcrumbItems} />
        {series && !podcastShow ? (
          <div className="sa-strip" style={{ "--sc": series.color } as React.CSSProperties}>
            <span className="sn">أنت تقرأ ضمن سلسلة «{series.name}» — {series.description}</span>
            <Link href={`/series/${series.slug}`}>تصفح السلسلة ←</Link>
          </div>
        ) : null}

        <article data-story-id={story.id}>
          {podcastShow ? (
            <PodcastShowView
              show={podcastShow}
              cover={podcastShow.cover ?? story.image}
              description={podcastShow.description || story.excerpt}
              since={published ? story.publishedAt : null}
              episodes={episodes}
            />
          ) : (
            <header className={`sa-head${videoUrl ? " has-video" : (isInfographicStory || !story.image) ? " no-media" : ""}`}>
              <div className="sa-head-copy">
                <div className="sa-head-top">
                  <h1>{story.title}</h1>
                  {fullExcerpt ? <p className="sa-dek">{fullExcerpt}</p> : null}
                </div>
              </div>
              <div className="sa-head-bottom">
                <div className="sa-byline">
                  <span className="sa-avatar" aria-hidden="true">ع</span>
                  <div>
                    <b>فريق العلم</b>
                    <span className="meta">
                      قراءة {formatReadingMinutes(story.readingMinutes)}
                    </span>
                  </div>
                </div>
                <div className="sa-head-actions"><a className="sa-jump" href="#article-body">ابدأ القراءة</a><ArticleLikeButton storyId={story.id} /><ArticleSaveButton storyId={story.id} joinHref={joinHref} /></div>
                {publishedTimestamp ? (
                  <div className="sa-timestamps">
                    <span>النشر: <time dateTime={story.publishedAt}>{publishedTimestamp}</time></span>
                    {updatedTimestamp ? (
                      <span>آخر تحديث: <time dateTime={story.updatedAt}>{updatedTimestamp}</time></span>
                    ) : null}
                    <span className="sa-timezone">بتوقيت الرياض</span>
                  </div>
                ) : null}
              </div>
              {videoUrl ? (
                <figure className="sa-media sa-video">
                  <VideoPlayer url={videoUrl} title={story.title} />
                </figure>
              ) : story.image && !isInfographicStory ? (
                <figure className="sa-media">
                  <div className="soft-img">
                    <Image
                      src={story.image} style={imageFocusStyle(story.imageFocus)}
                      alt={story.title}
                      fill
                      sizes="(max-width: 1040px) 100vw, 600px"
                      priority
                    />
                  </div>
                </figure>
              ) : null}
            </header>
          )}

          <ArticleTracker key={story.id} storyId={story.id} />
          <PublicReadingTracker key={`public-${story.id}`} storyId={story.id} />

          {!podcastShow && story.image && isInfographicStory ? (
            <InfographicLightbox src={story.image} title={story.title} />
          ) : null}

          {!podcastShow ? (
            <div className="sa-layout">
              <div className="sa-body">
                {reading.headings.length >= 2 && (
                  <nav className="article-outline" aria-label="في هذه المادة">
                    <h2 className="article-section-heading"><List aria-hidden="true" />في هذه المادة</h2>
                    <ul>{reading.headings.map(heading => <li key={heading.id}><a href={`#${heading.id}`}>{heading.title}</a></li>)}</ul>
                  </nav>
                )}
                <div className="article-body" id="article-body">
                  {story.body && looksLikeHtml(story.body) ? (
                    // متن محرر اللوحة الغني — يُنقّى عند العرض أيضًا؛ القاعدة ليست مصدر ثقة.
                    <BodyHtml html={responsiveBodyImages(reading.body)} />
                  ) : story.body ? (
                    story.body
                      .split(/\n{2,}/)
                      .filter((paragraph) => paragraph.trim())
                      .map((paragraph, index) => <p key={index}>{paragraph.trim()}</p>)
                  ) : story.excerpt ? <p>{fullExcerpt}</p> : (
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

                {reading.links.length > 0 && (
                  <aside className="article-sources" aria-label="روابط وردت في المادة">
                    <h2 className="article-section-heading"><Link2 aria-hidden="true" />روابط وردت في المادة</h2>
                    <ul>{reading.links.map(link => <li key={link.href}><a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a></li>)}</ul>
                  </aside>
                )}
                <ArticleKeywords keywords={story.keywords} />
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
                <ArticleToolbar storyId={story.id} title={story.title} joinHref={joinHref} excerpt={story.excerpt} shareUrl={publicShareUrl(shortStoryHref(story), sharingOrigin())} />

                <ArticleInsights key={story.id} storyId={story.id} readingMinutes={story.readingMinutes} />

                {series ? (
                  <div className="sa-next" style={{ "--sc": series.color } as React.CSSProperties}>
                    <span className="lbl">التالي في سلسلة «{series.name}»</span>
                    {sameSeries.map((item, index) => (
                      <Link key={item.id} href={storyHref(item)}>
                        {index === 0 && item.image ? (
                          <span className="soft-img">
                            <Image src={item.image} style={imageFocusStyle(item.imageFocus)} alt="" fill sizes="360px" />
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

          {podcastShow ? <ArticleKeywords keywords={story.keywords} /> : null}
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
    </>
  );
}
