import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { MiniCard, MosaicCard, VideoCard } from "@/app/_components/story-card";
import { seedContentProvider, seriesOf } from "@/lib/content/provider";
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
      <SiteHeader active="/politics" />

      <main id="main-content" className="wrap">
        {/* موجز اليوم */}
        <section className="ai-surface brief" aria-label="موجز اليوم">
          <span className="ai-chip"><span className="spark">✦</span> موجز العلم</span>
          <div className="brief-copy">
            <b>ما وراء خبر اليوم — في دقيقة</b>
            <span>يُبنى من مواد المحررين المنشورة، ويُحدَّث على مدار اليوم</span>
          </div>
          <div className="brief-items">
            {home.brief.map((item) => (
              <Link key={item.href} href={item.href} style={{ "--dot": item.color } as React.CSSProperties}>
                {item.title.length > 46 ? `${item.title.slice(0, 46)}…` : item.title}
              </Link>
            ))}
          </div>
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
              <h2>
                <Link href={storyHref(home.hero)}>{home.hero.title}</Link>
              </h2>
              <p>{home.hero.excerpt.slice(0, 150)}{home.hero.excerpt.length > 150 ? "…" : ""}</p>
              {home.hero.quickTake ? (
                <div className="quick-take">
                  <div className="qt-head">✦ خلاصة قبل القراءة</div>
                  <ul>
                    {home.hero.quickTake.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </article>

          <div className="b-side">
            {home.minis.map((story) => (
              <MiniCard key={story.id} story={story} />
            ))}
            {home.dataStory ? (
              <article className="data-card" data-story-id={home.dataStory.id}>
                <span className="kick">
                  {dataSeries ? `${dataSeries.name} · ` : ""}أسواق واقتصاد
                </span>
                <Link href={storyHref(home.dataStory)}>
                  <div className="data-num">
                    {(/(\d{2,4})\s*%/.exec(home.dataStory.title)?.[1]) ?? "—"}
                    <small>%</small>
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

        {/* حزام السلاسل */}
        <div className="section-head">
          <h2>تسع سلاسل، تسع طرق للفهم</h2>
          <span className="sub">لكل مادة سلسلتها — واللون يقودك</span>
          <Link className="more" href="/series/absat">كل السلاسل ←</Link>
        </div>
        <nav className="series-band" aria-label="سلاسل العلم">
          {home.series.map((series) => (
            <Link
              key={series.slug}
              className="series-seg"
              href={`/series/${series.slug}`}
              style={{ "--sc": series.color } as React.CSSProperties}
            >
              <b>{series.name}</b>
              <span>{series.description}</span>
            </Link>
          ))}
        </nav>

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

        {/* وراء الخبر */}
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
                  <div className="v">
                    {stat.value}
                    {stat.suffix ? <small>{stat.suffix}</small> : null}
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
