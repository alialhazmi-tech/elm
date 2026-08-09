import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteFooter, SiteHeader, UrgentBar } from "@/app/_components/site-chrome";
import { NewsCard, VideoCard } from "@/app/_components/story-card";
import { toEasternDigits } from "@/lib/format";
import { sectionName, seedContentProvider, seriesOf } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "العلم | الخبر كما هو",
  description:
    "منصة إعلام ومعرفة سعودية تنقل الخبر بدقة وتضعه في سياقه — تغطية محايدة وتحليل يذهب خلف العناوين.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const home = await seedContentProvider.getHome();
  const lead = home.hero;
  const leadSeries = seriesOf(lead);

  // «الأكثر قراءة» مواد فريدة لا تكرر المعروض في بقية الصفحة — عقد منع التكرار.
  const displayed = new Set(
    [lead, ...home.mosaic, home.minis[0], ...home.videos]
      .filter((story): story is NonNullable<typeof story> => Boolean(story))
      .map((story) => story.id),
  );
  const mostRead = (await seedContentProvider.listAll())
    .filter((story) => !displayed.has(story.id))
    .slice(0, 5);

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
      <UrgentBar story={lead} />

      <main id="main-content" className="wrap">
        {/* الخبر الرئيسي + الأكثر قراءة */}
        <section className="lead-grid" aria-label="أبرز الأخبار">
          <article className="lead-story" data-story-id={lead.id}>
            {lead.image ? (
              <Image
                className="l-img"
                src={lead.image}
                alt=""
                fill
                sizes="(max-width: 960px) 100vw, 62vw"
                priority
              />
            ) : null}
            <div className="lead-copy">
              <span className="badge">تغطية</span>
              <h2>
                <Link href={storyHref(lead)}>{lead.title}</Link>
              </h2>
              <p>{lead.excerpt.slice(0, 160)}{lead.excerpt.length > 160 ? "…" : ""}</p>
              <div className="lead-meta">
                <span>{leadSeries ? `${leadSeries.name} · ` : ""}{sectionName(lead.section)}</span>
                <span>{toEasternDigits(lead.readingMinutes)} دقائق قراءة</span>
              </div>
            </div>
          </article>

          <div className="side-col">
            <div className="most-read">
              <h3>الأكثر قراءة</h3>
              <ol>
                {mostRead.map((story, index) => (
                  <li key={story.id} data-story-id={story.id}>
                    <span className="no">{toEasternDigits(String(index + 1).padStart(2, "0"))}</span>
                    <Link href={storyHref(story)}>{story.title}</Link>
                  </li>
                ))}
              </ol>
            </div>
            <Link className="newsletter-box" href="/search">اشترك في النشرة</Link>
          </div>
        </section>

        {/* موجز اليوم */}
        <section className="brief" aria-label="موجز اليوم">
          <div className="brief-copy">
            <b>موجز العلم — ما وراء خبر اليوم</b>
            <span>يُبنى من مواد المحررين المنشورة ويُحدَّث على مدار اليوم</span>
          </div>
          <div className="brief-items">
            {home.brief.map((item) => (
              <Link key={item.href} href={item.href} style={{ "--dot": item.color } as React.CSSProperties}>
                {item.title.length > 44 ? `${item.title.slice(0, 44)}…` : item.title}
              </Link>
            ))}
          </div>
        </section>

        {/* وراء الخبر */}
        <div className="section-head">
          <h2>وراء الخبر</h2>
          <span className="sub">تحليل يذهب خلف العناوين إلى الأسباب والنتائج</span>
          <Link className="more" href="/politics">الأرشيف ←</Link>
        </div>
        <section className="story-grid" aria-label="وراء الخبر">
          {home.mosaic[0] ? <NewsCard story={home.mosaic[0]} withImage showExcerpt /> : null}
          {home.mosaic[1] ? <NewsCard story={home.mosaic[1]} withImage showExcerpt /> : null}
          {home.minis[0] ? <NewsCard story={home.minis[0]} withImage showExcerpt /> : null}
        </section>

        {/* السلاسل */}
        <div className="section-head">
          <h2>سلاسل العلم</h2>
          <span className="sub">تسع طرق للفهم — لكل مادة سلسلتها</span>
        </div>
        <nav className="series-band" aria-label="سلاسل العلم">
          {home.series.map((series) => (
            <Link key={series.slug} className="series-seg" href={`/series/${series.slug}`}>
              <b>{series.name}</b>
              <span>{series.description}</span>
            </Link>
          ))}
        </nav>

        {/* بالأرقام */}
        {home.numbers.length > 0 ? (
          <section className="numbers" aria-label="بالأرقام">
            <div className="section-head">
              <h2>بالأرقام</h2>
              <span className="sub">كل رقم يحيل إلى مصدره</span>
            </div>
            <div className="num-grid">
              {home.numbers.map((stat) => (
                <Link key={stat.label} className="num-card" href={stat.href ?? "/infographics"}>
                  <div className="v">
                    {toEasternDigits(`${stat.value}${stat.suffix ?? ""}`)}
                  </div>
                  <div className="rule" aria-hidden="true" />
                  <p>{stat.label}</p>
                </Link>
              ))}
            </div>
            <div className="num-foot">المصدر: مواد العلم المنشورة — الأرقام تُستخرج من العناوين وتحيل إليها</div>
          </section>
        ) : null}

        {/* اسأل العلم */}
        <section className="ask-block" aria-label="البحث في العلم">
          <div className="section-head">
            <h2>ابحث في العلم</h2>
            <span className="sub">يتجاهل التشكيل واختلاف الهمزات</span>
          </div>
          <form className="ask-form" action="/search" role="search">
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
              <h2>مرئي</h2>
              <span className="sub">المعرفة بأكثر من شكل</span>
              <Link className="more" href="/videos">كل الوسائط ←</Link>
            </div>
            <section className="media-row" aria-label="مرئي">
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
