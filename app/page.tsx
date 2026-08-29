import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { VideoCard } from "@/app/_components/story-card";
import { brandDate, formatReadingMinutes, relativeTimeAr, riyadhDateISO, toLatinDigits } from "@/lib/format";
import { sectionName, seedContentProvider, seriesDirectory, seriesOf } from "@/lib/content/provider";
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

/** سطر السلسلة/القسم بنقطة ملونة — يُستخدم في كل بطاقات الرئيسية. */
function Kick({ story }: { story: Story }) {
  const series = seriesOf(story);
  return (
    <span className="kick" style={{ "--kc": series?.color } as React.CSSProperties}>
      {series?.name ?? sectionName(story.section)}
      {series ? <span className="sect">· {sectionName(story.section)}</span> : null}
    </span>
  );
}

export default async function Home() {
  const [home, directory] = await Promise.all([
    seedContentProvider.getHome(),
    seriesDirectory().catch(() => ({} as Awaited<ReturnType<typeof seriesDirectory>>)),
  ]);
  const hero = home.hero;
  const today = brandDate(new Date().toISOString());

  // «وراء الخبر»: مرتكز + 3 صفوف + سؤال الأسبوع.
  const contextFeatured = home.mosaic[0];
  const contextRows: Story[] = home.mosaic.slice(1, 4);

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

      <main id="main-content" className="wrap home-shell">
        <div className="day-line" aria-label="تاريخ اليوم">
          <time dateTime={riyadhDateISO()}>
            {toLatinDigits(today.hijri)}
            <span aria-hidden="true"> · </span>
            {toLatinDigits(today.gregorian)}
          </time>
          <span className="live">تغطية مستمرة</span>
        </div>

        {/* الصدارة: لوحة ناعمة — النص يمينًا والصورة يسارًا بلا طبقة داكنة */}
        {hero ? (
          <section className="sh-lead" aria-label="قصة الصدارة" data-story-id={hero.id}>
            <div className="sh-lead-copy">
              <Kick story={hero} />
              <h1>
                <Link className="story-link" href={storyHref(hero)}>{hero.title}</Link>
              </h1>
              {hero.excerpt ? <p className="dek">{trimExcerpt(hero.excerpt, 200)}</p> : null}
              <div className="sh-lead-actions">
                <Link className="btn-pill" href={storyHref(hero)}>
                  {hero.series === "limatha" ? "اقرأ الإجابة" : "اقرأ المادة"}
                </Link>
                <span className="meta">
                  قراءة {formatReadingMinutes(hero.readingMinutes)} · تحرير: فريق العلم
                </span>
              </div>
            </div>
            {hero.image ? (
              <Link className="sh-lead-media" href={storyHref(hero)} aria-hidden="true" tabIndex={-1}>
                <Image src={hero.image} alt="" fill sizes="(max-width: 1040px) 100vw, 560px" priority />
              </Link>
            ) : null}
          </section>
        ) : (
          <section className="sh-lead empty-state">
            <div className="sh-lead-copy">
              <h1>لا مواد منشورة بعد</h1>
              <p className="dek">الأرشيف يُجهَّز الآن. ستظهر المواد هنا فور اكتمال السحب.</p>
            </div>
          </section>
        )}

        {/* الموجز: أربع بطاقات خفيفة */}
        {home.brief.length > 0 ? (
          <section className="sh-digest" aria-label="موجز العلم">
            {home.brief.slice(0, 4).map((item) => {
              const when = relativeTimeAr(item.publishedAt);
              return (
                <article key={item.href}>
                  <span className="kick" style={{ "--kc": item.color } as React.CSSProperties}>{item.label}</span>
                  <h3><Link className="story-link" href={item.href}>{item.title}</Link></h3>
                  {when ? <span className="meta">{when}</span> : null}
                </article>
              );
            })}
          </section>
        ) : null}

        {/* اسأل العلم */}
        <section className="ask-band" aria-labelledby="ask-title">
          <div className="ask-band-info">
            <h2 id="ask-title">اسأل العلم</h2>
            <p className="ask-sub">بحث ذكي يجيب من أرشيف موادنا مباشرة</p>
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
              <span aria-hidden="true">·</span>
              <Link href="/search?q=تود بلانش">من هو تود بلانش؟</Link>
              <span aria-hidden="true">·</span>
              <Link href="/search?q=الجاذبية">شائعة الجاذبية</Link>
            </p>
          </div>
        </section>

        {/* السلاسل — عمود العلم الفقري، بلاطات بلون كل سلسلة */}
        <section className="sh-section" aria-label="السلاسل">
          <div className="section-head">
            <h2>السلاسل</h2>
            <Link className="more" href="/series">كل السلاسل ←</Link>
          </div>
          <div className="sh-series">
            {home.series.map((series) => {
              const entry = directory[series.slug];
              return (
                <Link
                  key={series.slug}
                  className="series-lens"
                  href={`/series/${series.slug}`}
                  style={{ "--sc": series.color } as React.CSSProperties}
                >
                  <span className="sname">{series.name}</span>
                  <span className="slatest">{entry?.latest?.title ?? series.description}</span>
                  {entry?.count ? (
                    <span className="scount">{toLatinDigits(String(entry.count))} مادة</span>
                  ) : (
                    <span className="scount">{series.description}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        {/* وراء الخبر */}
        {contextFeatured || contextRows.length > 0 ? (
          <section className="sh-section" aria-label="وراء الخبر">
            <div className="section-head">
              <h2>وراء الخبر</h2>
              <Link className="more" href="/politics">الأرشيف ←</Link>
            </div>
            <div className="sh-context">
              {contextFeatured ? (
                <article className="sh-ctx-featured" data-story-id={contextFeatured.id}>
                  {contextFeatured.image ? (
                    <Link className="soft-img" href={storyHref(contextFeatured)} aria-hidden="true" tabIndex={-1}>
                      <Image src={contextFeatured.image} alt="" fill sizes="(max-width: 1040px) 100vw, 560px" />
                    </Link>
                  ) : null}
                  <Kick story={contextFeatured} />
                  <h3><Link className="story-link" href={storyHref(contextFeatured)}>{contextFeatured.title}</Link></h3>
                  {contextFeatured.excerpt ? <p>{trimExcerpt(contextFeatured.excerpt, 150)}</p> : null}
                </article>
              ) : null}
              {contextRows.length > 0 ? (
                <div className="sh-ctx-rows">
                  {contextRows.map((story) => (
                    <article className="sh-ctx-row" key={story.id} data-story-id={story.id}>
                      {story.image ? (
                        <Link className="soft-img" href={storyHref(story)} aria-hidden="true" tabIndex={-1}>
                          <Image src={story.image} alt="" fill sizes="150px" />
                        </Link>
                      ) : null}
                      <div className="body">
                        <Kick story={story} />
                        <h3><Link className="story-link" href={storyHref(story)}>{story.title}</Link></h3>
                        <span className="meta">قراءة {formatReadingMinutes(story.readingMinutes)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
            {home.question ? (
              <article className="sh-why">
                <div className="body">
                  <span className="kick" style={{ "--kc": "#14a8d6" } as React.CSSProperties}>
                    {home.question.kick || "لماذا"} <span className="sect">· سؤال الأسبوع</span>
                  </span>
                  <h3><Link className="story-link" href={home.question.href}>{home.question.title}</Link></h3>
                  <p>{home.question.text}</p>
                </div>
                <Link className="btn-pill" href={home.question.href}>اقرأ الإجابة</Link>
              </article>
            ) : null}
          </section>
        ) : null}

        {/* بالأرقام */}
        {home.numbers.length > 0 ? (
          <section className="sh-section" aria-label="بالأرقام">
            <div className="section-head">
              <h2>بالأرقام</h2>
              <span className="sub">كل رقم يحيل إلى مصدره</span>
            </div>
            <div className="figures">
              {home.numbers.slice(0, 3).map((stat) => (
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
            </div>
          </section>
        ) : null}

        {/* مرئي وصوتي + الأكثر قراءة */}
        <div className="home-two">
          {home.videos.length > 0 ? (
            <div className="home-media">
              <div className="section-head">
                <h2>مرئي وصوتي</h2>
                <Link className="more" href="/videos">كل الوسائط ←</Link>
              </div>
              <section className="media-grid" aria-label="مرئي وصوتي">
                {home.videos.slice(0, 2).map((story) => (
                  <VideoCard key={story.id} story={story} />
                ))}
              </section>
            </div>
          ) : null}
          {home.mostRead.length > 0 ? (
            <section className="most-read" aria-label="الأكثر قراءة">
              <div className="section-head">
                <h2>الأكثر قراءة</h2>
              </div>
              <ol className="most-read-list">
                {home.mostRead.slice(0, 4).map((story, index) => (
                  <li key={story.id} data-story-id={story.id}>
                    <span className="mr-no latin-number" dir="ltr" lang="en" aria-hidden="true">
                      {toLatinDigits(String(index + 1))}
                    </span>
                    <div className="mr-body">
                      <Link className="story-link" href={storyHref(story)}>{story.title}</Link>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
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
