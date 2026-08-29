import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { SeriesRail } from "@/app/_components/series-navigator";
import { LeadMedia } from "@/app/_components/lead-media";
import { ContextRowCard, VideoCard } from "@/app/_components/story-card";
import { brandDate, formatReadingMinutes, relativeTimeAr, riyadhDateISO, toLatinDigits } from "@/lib/format";
import { sectionName, seedContentProvider, seriesOf } from "@/lib/content/provider";
import { storyHref, type Story } from "@/lib/content/types";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "العلم | المعرفة وراء الخبر",
  description:
    "منصة إعلام ومعرفة سعودية تشرح ما وراء الخبر عبر السلاسل والبيانات والفيديو والبودكاست.",
  alternates: { canonical: "/" },
};

const trimExcerpt = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

export default async function Home() {
  const home = await seedContentProvider.getHome();
  const hero = home.hero;
  const heroSeries = hero ? seriesOf(hero) : undefined;
  const heroKick = heroSeries?.name ?? (hero?.eyebrow || null);
  const today = brandDate(new Date().toISOString());

  // «وراء الخبر»: مرتكز + 4 صفوف أفقية متناسقة + سؤال تحليلي.
  const contextFeatured = home.mosaic[0];
  const featuredSeries = contextFeatured ? seriesOf(contextFeatured) : undefined;
  const featuredKick = featuredSeries?.name ?? (contextFeatured?.eyebrow || null);
  const contextRows: Story[] = home.mosaic.slice(1, 5);

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
      <SiteHeader active="/" />
      <SeriesRail series={home.series} />

      <main id="main-content" className="wrap home-shell">
        <div className="day-line" aria-label="تاريخ اليوم">
          <time dateTime={riyadhDateISO()}>
            {toLatinDigits(today.hijri)}
            <span aria-hidden="true"> · </span>
            {toLatinDigits(today.gregorian)}
          </time>
          <span className="live">تغطية مستمرة</span>
        </div>

        {/* الصدارة: القصة القائدة + موجز العلم */}
        <section className="lead-region" aria-label="قصة الصدارة وموجز العلم">
          {hero ? (
          <article className="lead" data-story-id={hero.id}>
            {hero.image ? (
              <LeadMedia src={hero.image} href={storyHref(hero)} />
            ) : null}
            <div className="lead-copy">
              <span
                className="kicker"
                style={{ "--kc": heroSeries?.color } as React.CSSProperties}
              >
                {heroKick ?? sectionName(hero.section)}
                {heroKick ? (
                  <span className="sect">· {sectionName(hero.section)}</span>
                ) : null}
              </span>
              <h1>
                <Link className="story-link" href={storyHref(hero)}>
                  {hero.title}
                </Link>
              </h1>
              {hero.excerpt ? (
                <p className="dek">{trimExcerpt(hero.excerpt, 180)}</p>
              ) : null}
              <div className="story-meta">
                <span><b>قراءة {formatReadingMinutes(hero.readingMinutes)}</b></span>
                <span>تحرير: فريق العلم</span>
              </div>
            </div>
          </article>
          ) : (
          <article className="lead empty-state">
            <h1>لا مواد منشورة بعد</h1>
            <p className="dek">الأرشيف يُجهَّز الآن. ستظهر المواد هنا فور اكتمال السحب.</p>
          </article>
          )}

          {home.brief.length > 0 ? (
          <aside className="briefing" aria-labelledby="briefing-title">
            <header className="rubric">
              <h2 id="briefing-title">موجز العلم</h2>
              <span className="sub">يُحدّث على مدار اليوم</span>
            </header>
            <ol>
              {home.brief.map((item) => {
                const when = relativeTimeAr(item.publishedAt);
                return (
                  <li key={item.href}>
                    <span
                      className="kicker"
                      style={{ "--kc": item.color } as React.CSSProperties}
                    >
                      {item.label}
                      {when ? <time className="when">{when}</time> : null}
                    </span>
                    <h3>
                      <Link className="story-link" href={item.href}>{item.title}</Link>
                    </h3>
                  </li>
                );
              })}
            </ol>
            <footer className="briefing-foot">
              مختار من مواد المحررين المنشورة
            </footer>
          </aside>
          ) : null}
        </section>

        {/* اسأل العلم */}
        <section className="ask-band" aria-labelledby="ask-title">
          <div className="ask-band-info">
            <div className="ask-band-badge">
              <span className="ask-spark" aria-hidden="true">✦</span>
              <span>ذكاء العلم التحريري</span>
            </div>
            <h2 id="ask-title">اسأل العلم</h2>
            <p className="ask-sub">
              بحث ذكي يفهم سؤالك ويجيب مباشرة من أرشيف مواد محررينا — مع تجاهل التشكيل واختلاف الهمزات.
            </p>
          </div>
          <div className="ask-band-interactive">
            <form className="ask-band-form" action="/search" role="search">
              <input
                type="search"
                name="q"
                placeholder="لماذا ترتفع أسعار التنجستن؟"
                aria-label="ابحث في العلم"
                dir="rtl"
              />
              <button type="submit">اسأل</button>
            </form>
            <p className="ask-suggest">
              <span className="suggest-lbl">جرّب:</span>
              <Link href="/search?q=التنجستن">أسعار التنجستن</Link>
              <span aria-hidden="true"> · </span>
              <Link href="/search?q=تود بلانش">من هو تود بلانش؟</Link>
              <span aria-hidden="true"> · </span>
              <Link href="/search?q=الجاذبية">شائعة الجاذبية</Link>
            </p>
          </div>
        </section>

        {/* وراء الخبر — مرتكز + صفوف أفقية + سؤال */}
        {contextFeatured || contextRows.length > 0 || home.question ? (
        <>
        <div className="section-head">
          <h2>وراء الخبر</h2>
          <span className="sub">السياق قبل السرعة</span>
          <Link className="more" href="/politics">الأرشيف ←</Link>
        </div>
        <section className="context-grid" aria-label="وراء الخبر">
          {contextFeatured ? (
            <article
              className="ctx-featured"
              style={{ "--kc": featuredSeries?.color } as React.CSSProperties}
              data-story-id={contextFeatured.id}
            >
              {contextFeatured.image ? (
                <div className="ctx-media">
                  <Image
                    src={contextFeatured.image}
                    alt=""
                    fill
                    sizes="(max-width: 940px) 100vw, 470px"
                  />
                </div>
              ) : null}
              <span className="kicker">
                {featuredKick ?? sectionName(contextFeatured.section)}
                {featuredKick ? (
                  <span className="sect">· {sectionName(contextFeatured.section)}</span>
                ) : null}
              </span>
              <h3>
                <Link className="story-link" href={storyHref(contextFeatured)}>
                  {contextFeatured.title}
                </Link>
              </h3>
              {contextFeatured.excerpt ? (
                <p>{trimExcerpt(contextFeatured.excerpt, 140)}</p>
              ) : null}
              <div className="story-meta">
                <span><b>قراءة {formatReadingMinutes(contextFeatured.readingMinutes)}</b></span>
              </div>
            </article>
          ) : null}

          {contextRows.length > 0 ? (
            <div className="ctx-rows">
              {contextRows.map((story) => (
                <ContextRowCard key={story.id} story={story} />
              ))}
            </div>
          ) : null}

          {home.question ? (
            <article className="why-panel">
              <div className="why-panel-head">
                <span className="why-badge">
                  <span className="why-dot" aria-hidden="true" />
                  {home.question.kick || "لماذا"}
                </span>
                <span className="why-label">سؤال الأسبوع</span>
              </div>
              <div className="why-panel-body">
                <h3>
                  <Link className="story-link" href={home.question.href}>
                    {home.question.title}
                  </Link>
                </h3>
                <p>{home.question.text}</p>
              </div>
              <Link className="why-action" href={home.question.href}>
                <span>اقرأ الإجابة والتحليل</span>
                <span className="why-arrow" aria-hidden="true">←</span>
              </Link>
            </article>
          ) : null}
        </section>
        </>
        ) : null}

        {/* بالأرقام */}
        {home.numbers.length > 0 ? (
          <>
            <div className="section-head">
              <h2>بالأرقام</h2>
              <span className="sub">كل رقم يحيل إلى مصدره</span>
            </div>
            <section className="figures" aria-label="بالأرقام">
              {home.numbers.slice(0, 4).map((stat) => (
                <div className="figure-cell" key={stat.label}>
                  <div className="v latin-number" dir="ltr" lang="en">
                    {toLatinDigits(stat.value)}
                    {stat.suffix ? <small>{toLatinDigits(stat.suffix)}</small> : null}
                  </div>
                  <p>{stat.label}</p>
                  <Link className="src" href={stat.href ?? "/infographics"}>
                    المصدر <span aria-hidden="true">←</span>
                  </Link>
                </div>
              ))}
            </section>
            <p className="figures-note">
              الأرقام تُستخرج من المواد المنشورة وتحيل إليها مباشرة.
            </p>
          </>
        ) : null}

        {/* الأكثر قراءة + مرئي وصوتي — عمودان */}
        <div className="home-two">
        {home.mostRead.length > 0 ? (
          <section className="most-read" aria-label="الأكثر قراءة">
            <div className="section-head">
              <h2>الأكثر قراءة</h2>
              <span className="sub">خلال الساعات الماضية</span>
            </div>
            <ol className="most-read-list">
              {home.mostRead.map((story, index) => {
                const series = seriesOf(story);
                return (
                  <li key={story.id} data-story-id={story.id}>
                    <span className="mr-no latin-number" dir="ltr" lang="en" aria-hidden="true">
                      {toLatinDigits(String(index + 1).padStart(2, "0"))}
                    </span>
                    <div className="mr-body">
                      <span className="mr-kick">
                        {series?.name ?? sectionName(story.section)}
                      </span>
                      <Link className="story-link" href={storyHref(story)}>{story.title}</Link>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {home.videos.length > 0 ? (
          <div className="home-media">
            <div className="section-head">
              <h2>مرئي وصوتي</h2>
              <span className="sub">المعرفة بأكثر من شكل</span>
              <Link className="more" href="/videos">كل الوسائط ←</Link>
            </div>
            <section className="media-grid" aria-label="مرئي وصوتي">
              {home.videos.slice(0, 2).map((story) => (
                <VideoCard key={story.id} story={story} />
              ))}
            </section>
          </div>
        ) : null}
        </div>
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
