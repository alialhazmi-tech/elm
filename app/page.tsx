import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { SeriesNavigator } from "@/app/_components/series-navigator";
import { MiniCard, MosaicCard, VideoCard } from "@/app/_components/story-card";
import { brandDate, toLatinDigits } from "@/lib/format";
import { sectionName, seedContentProvider, seriesOf } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "العلم | المعرفة وراء الخبر",
  description:
    "منصة إعلام ومعرفة سعودية تشرح ما وراء الخبر عبر السلاسل والبيانات والفيديو والبودكاست.",
  alternates: { canonical: "/" },
};

const BAR_HEIGHTS = [18, 24, 30, 42, 58, 79, 100];

export default async function Home() {
  const home = await seedContentProvider.getHome();
  const heroSeries = seriesOf(home.hero);
  const dataSeries = home.dataStory ? seriesOf(home.dataStory) : undefined;
  const today = brandDate(new Date().toISOString());

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

      <main id="main-content" className="wrap">
        <div className="day-strip" aria-label="تاريخ اليوم">
          <time dateTime={new Date().toISOString().slice(0, 10)}>
            {toLatinDigits(today.hijri)}
            <span aria-hidden="true"> · </span>
            {toLatinDigits(today.gregorian)}
          </time>
          <span className="day-strip-tag">تغطية مستمرة</span>
        </div>

        <SeriesNavigator series={home.series} />

        {/* موجز العلم: مدخل تحريري سريع إلى أهم زوايا اليوم */}
        <section className="brief" aria-labelledby="brief-title">
          <header className="brief-head">
            <div className="brief-brand">
              <span className="brief-mark" aria-hidden="true">✦</span>
              <div>
                <span className="brief-kicker">موجز العلم</span>
                <span className="brief-status">يُحدّث على مدار اليوم</span>
              </div>
            </div>
            <div className="brief-intro">
              <h2 id="brief-title">المشهد اليوم، بوضوح.</h2>
              <p>ثلاث قصص مختارة تمنحك الصورة الأهم قبل التفاصيل.</p>
            </div>
          </header>

          <ol className="brief-items">
            {home.brief.map((item, index) => (
              <li key={item.href} style={{ "--brief-accent": item.color } as React.CSSProperties}>
                <Link href={item.href}>
                  <span className="brief-item-top">
                    <span className="brief-label">{item.label}</span>
                    <span className="brief-no latin-number" dir="ltr" lang="en">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <strong>{item.title}</strong>
                  <span className="brief-action" aria-hidden="true">اقرأ القصة <b>←</b></span>
                </Link>
              </li>
            ))}
          </ol>

          <footer className="brief-foot">
            <span>مختار من مواد المحررين المنشورة</span>
            <span>مختصر، موثوق، ومن دون ضجيج</span>
          </footer>
        </section>

        {/* البنتو الرئيسي */}
        <section className="bento" aria-label="أبرز المواد">
          <article className="b-main" data-story-id={home.hero.id}>
            {home.hero.image ? (
              <Image
                className="b-img"
                src={home.hero.image}
                alt=""
                fill
                sizes="(max-width: 940px) 100vw, 58vw"
                priority
              />
            ) : null}
            <div className="b-main-copy">
              {heroSeries ? (
                <Link
                  className="series-chip"
                  href={`/series/${heroSeries.slug}`}
                  style={{ "--sc": heroSeries.color } as React.CSSProperties}
                >
                  {heroSeries.name}
                </Link>
              ) : null}
              <h1>
                <Link className="stretched" href={storyHref(home.hero)}>
                  {home.hero.title}
                </Link>
              </h1>
              <div className="b-meta">
                <span>{sectionName(home.hero.section)}</span>
                <span>{toLatinDigits(home.hero.readingMinutes)} دقائق قراءة</span>
              </div>
            </div>
          </article>

          <div className="b-side">
            {home.minis.map((story) => (
              <MiniCard key={story.id} story={story} />
            ))}
            {home.dataStory ? (
              <article className="data-card" data-story-id={home.dataStory.id}>
                <Link className="stretched data-card-link" href={storyHref(home.dataStory)}>
                  <span className="kick">
                    {dataSeries ? `${dataSeries.name} · ` : ""}أسواق واقتصاد
                  </span>
                  <div className="data-num latin-number" dir="ltr" lang="en">
                    {toLatinDigits((/(\d{2,4})\s*%/.exec(home.dataStory.title)?.[1]) ?? "—")}
                    <small>٪</small>
                  </div>
                  <p>{home.dataStory.title}</p>
                </Link>
                <div className="bars" aria-hidden="true">
                  {BAR_HEIGHTS.map((height, index) => (
                    <i key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
                <div className="data-foot">
                  <span className="spark">✦</span> اللوحة مشتقة من أرقام المادة — والمصدر بنقرة
                </div>
              </article>
            ) : null}
          </div>
        </section>

        {/* الأكثر قراءة */}
        {home.mostRead.length > 0 ? (
          <section className="most-read" aria-label="الأكثر قراءة">
            <div className="section-head">
              <h2>الأكثر قراءة</h2>
              <span className="sub">مواد أخرى تستحق الانتباه</span>
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
                      <span
                        className="mr-kick"
                        style={{ color: series?.color ?? "var(--ink-3)" }}
                      >
                        {series?.name ?? sectionName(story.section)}
                      </span>
                      <Link href={storyHref(story)}>{story.title}</Link>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {/* وراء الخبر — المحتوى قبل خريطة السلاسل */}
        <div className="section-head">
          <h2>وراء الخبر</h2>
          <span className="sub">السياق قبل السرعة</span>
          <Link className="more" href="/politics">الأرشيف ←</Link>
        </div>
        <section className="mosaic" aria-label="وراء الخبر">
          {home.mosaic[0] ? <MosaicCard story={home.mosaic[0]} tall /> : null}
          {home.mosaic[1] ? <MosaicCard story={home.mosaic[1]} className="m-wide" /> : null}
          {home.question ? (
            <article className="q-card">
              <span className="q-mark" aria-hidden="true">؟</span>
              <div className="m-kick"><span>لماذا</span></div>
              <h3>
                <Link href={home.question.href}>{home.question.title}</Link>
              </h3>
              <p>{home.question.text}</p>
            </article>
          ) : null}
        </section>

        {/* بالأرقام */}
        {home.numbers.length > 0 ? (
          <section className="numbers" aria-label="بالأرقام">
            <div className="section-head">
              <h2>بالأرقام</h2>
              <span className="sub">أرقام من المواد — وكل رقم يحيل لمصدره</span>
            </div>
            <div className="num-grid">
              {home.numbers.map((stat) => (
                <Link key={stat.label} className="num-card" href={stat.href ?? "/infographics"}>
                  <div className="v latin-number" dir="ltr" lang="en">
                    {toLatinDigits(stat.value)}
                    {stat.suffix ? <small>{toLatinDigits(stat.suffix)}</small> : null}
                  </div>
                  <p>{stat.label}</p>
                </Link>
              ))}
            </div>
            <div className="num-foot">
              <span className="spark">✦</span> الأرقام تُستخرج من عناوين المواد المنشورة وتحيل إليها
            </div>
          </section>
        ) : null}

        {/* اسأل العلم */}
        <section className="ai-surface ask-block" aria-label="اسأل العلم">
          <div className="section-head" style={{ margin: "0 0 16px" }}>
            <h2>اسأل العلم — البحث الذي يجيب</h2>
            <span className="sub">يبحث في أرشيف محررينا — ويتجاهل التشكيل واختلاف الهمزات</span>
          </div>
          <form className="ask-form" action="/search" role="search">
            <span className="spark" aria-hidden="true">✦</span>
            <input
              type="search"
              name="q"
              placeholder="لماذا ترتفع أسعار التنجستن؟"
              aria-label="ابحث في العلم"
              dir="rtl"
            />
            <button type="submit">ابحث</button>
          </form>
          <div className="ask-foot">
            <span>الإجابات الذكية بالإحالة إلى المصدر تصل مع مرحلة خدمات الذكاء.</span>
            <div className="sugg">
              <Link href="/search?q=التنجستن">أسعار التنجستن</Link>
              <Link href="/search?q=تود بلانش">من هو تود بلانش؟</Link>
              <Link href="/search?q=الجاذبية">شائعة الجاذبية</Link>
            </div>
          </div>
        </section>

        {/* مرئي */}
        {home.videos.length > 0 ? (
          <>
            <div className="section-head">
              <h2>مرئي وصوتي</h2>
              <span className="sub">المعرفة بأكثر من شكل</span>
              <Link className="more" href="/videos">كل الوسائط ←</Link>
            </div>
            <section className="media-row" aria-label="مرئي وصوتي">
              {home.videos.map((story) => (
                <VideoCard key={story.id} story={story} />
              ))}
            </section>
          </>
        ) : null}
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
