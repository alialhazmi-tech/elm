import "./home.css";
import { createHash } from "node:crypto";
import { BriefListen } from "./_components/home-brief-listen";
import { homeBriefScript } from "@/lib/voice/home-brief";
import { sharingMetadata, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/sharing";
import { loadPublicTaxonomy } from "@/lib/content/taxonomy-settings";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { VideoCard } from "@/app/_components/story-card";
import { InfographicGallery, NewsRiver } from "@/app/_components/home-stream";
import { HomeAskBand } from "@/app/_components/home-ask-band";
import { SeriesSpectrum } from "@/app/_components/series-navigator";
import { homeStream } from "@/lib/content/homeStream";
import { relativeTimeAr } from "@/lib/format";
import { brandDate, formatReadingMinutes, riyadhDateISO, toLatinDigits } from "@/lib/format";
import { sectionName, seedContentProvider, seriesDirectory, seriesOf } from "@/lib/content/provider";
import { storyHref, type Story } from "@/lib/content/types";

export const revalidate = 120;

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  ...sharingMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: "/" }),
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
      {series ? <span className="sect">{sectionName(story.section)}</span> : null}
    </span>
  );
}

// كيكر + عنوان قائدة البلوك — يُركَّب فوق الصورة حين توجد، وتحتها حين لا توجد.
function LeadHead({ story }: { story: Story }) {
  return (
    <>
      <Kick story={story} />
      <h3><Link className="story-link" href={storyHref(story)}>{story.title}</Link></h3>
    </>
  );
}

export default async function Home() {
  const taxonomy = await loadPublicTaxonomy();
  const [home, directory] = await Promise.all([
    seedContentProvider.getHome(),
    seriesDirectory().catch(() => ({} as Awaited<ReturnType<typeof seriesDirectory>>)),
  ]);
  const briefText = homeBriefScript(home.brief);
  const hero = home.hero;
  // التدفّق: يستبعد ما تعرضه الصدارة و«وراء الخبر» ومختارات من الأرشيف حتى لا يتكرر خبر في الصفحة.
  const shownIds = new Set<string>([hero?.id, ...home.mosaic.map((s) => s.id), ...home.mostRead.map((s) => s.id)].filter((id): id is string => Boolean(id)));
  const stream = await homeStream(shownIds).catch(() => null);
  // مختارات من الأرشيف لا يكرر ما يعرضه معرض الإنفوجرافيك أو النهر أو اللوحات.
  const streamIds = new Set<string>([
    ...(stream?.river ?? []).map((s) => s.id),
    ...(stream?.infographics ?? []).map((s) => s.id),
    ...(stream?.panels ?? []).flatMap((panel) => [panel.lead?.id, ...panel.rows.map((s) => s.id)]).filter((id): id is string => Boolean(id)),
  ]);
  const mostRead = home.mostRead.filter((s) => !streamIds.has(s.id)).slice(0, 4);
  const riverItems = (stream?.river ?? []).map((story) => {
    const series = seriesOf(story);
    return {
      id: story.id, href: storyHref(story), title: story.title, image: story.image ?? null,
      kick: series?.name ?? sectionName(story.section), color: series?.color ?? null,
      when: relativeTimeAr(story.publishedAt) ?? "", publishedAt: story.publishedAt ?? null,
      fresh: Boolean(story.publishedAt && stream && stream.pulse.nowMs - Date.parse(story.publishedAt) < 3_600_000),
    };
  });
  const today = brandDate(new Date().toISOString());

  // سطر تحديث الموجز يقرأ من أحدث مادة فيه.
  const briefUpdated = relativeTimeAr(
    home.brief.map((item) => item.publishedAt).filter(Boolean).sort().at(-1) ?? undefined,
  );

  // «وراء الخبر»: مرتكز + 3 صفوف تحريرية.
  const contextFeatured = home.mosaic[0];
  const contextRows: Story[] = home.mosaic.slice(1, 4);

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader active="/" activeSeries={home.series[0]?.slug} rail />

      <main id="main-content" className="wrap home-shell">
        <div className="day-line" aria-label="تاريخ اليوم">
          <time dateTime={riyadhDateISO()}>
            {toLatinDigits(today.hijri)}
            <span aria-hidden="true">، </span>
            {toLatinDigits(today.gregorian)}
          </time>
          <span className="live">تغطية مستمرة</span>
        </div>

        {/* الصدارة + موجز العلم: لوحة ناعمة يمينًا وبطاقة الموجز يسارًا */}
        <div className="sh-top">
        {hero ? (
          <section
            className="sh-lead"
            aria-label="قصة الصدارة"
            data-story-id={hero.id}
          >
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
                  قراءة {formatReadingMinutes(hero.readingMinutes)}، تحرير فريق العلم
                </span>
              </div>
            </div>
            {hero.image ? (
              <Link className="sh-lead-media" href={storyHref(hero)} aria-hidden="true" tabIndex={-1}>
                <Image src={hero.image} alt="" fill sizes="(max-width: 900px) 100vw, 560px" quality={(hero.format === "news" || !hero.format) && hero.section !== "infographics" ? 60 : 75} loading="eager" fetchPriority="high" />
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

        {/* موجز العلم: خمسة عناوين مرقّمة مع سطري ثقة وشفافية */}
        {home.brief.length > 0 ? (
          <aside className="sh-brief" aria-labelledby="brief-title">
            <div className="sh-brief-head">
              <div className="sh-brief-title-row">
                <h2 id="brief-title">
                  <span className="spark" aria-hidden="true">✦</span> موجز العلم
                </h2>
              </div>
              {briefUpdated ? (
                <span className="sh-brief-trust">
                  تحديث {briefUpdated}، مختار من {toLatinDigits(String(home.briefFrom))} مادة منشورة في أرشيفنا
                </span>
              ) : null}
            </div>
            <BriefListen key={createHash("sha256").update(briefText).digest("hex")} />
            <ol className="sh-brief-list">
              {home.brief.map((item, index) => (
                <li key={item.href}>
                  <span className="bno latin-number" dir="ltr" lang="en" aria-hidden="true">
                    {toLatinDigits(String(index + 1))}
                  </span>
                  <div className="bbody">
                    <span className="kick" style={{ "--kc": item.color } as React.CSSProperties}>
                      {item.label}
                      {relativeTimeAr(item.publishedAt) ? (
                        <span className="sect">{relativeTimeAr(item.publishedAt)}</span>
                      ) : null}
                    </span>
                    <h3><Link className="story-link" href={item.href}>{item.title}</Link></h3>
                  </div>
                </li>
              ))}
            </ol>
            <p className="sh-brief-why">
              لماذا هذه المواد؟ مختارات آلية من أحدث المواد عبر الأقسام. كل عنوان يحيل إلى مادته المنشورة.
            </p>
            <details className="sh-brief-transcript">
              <summary>نص النشرة الصوتية</summary>
              <p>{briefText}</p>
            </details>
          </aside>
        ) : null}
        </div>

        {/* نبض اليوم + الجديد الآن */}
        {stream && riverItems.length > 0 ? (
          <section className="sh-stream" aria-label="الجديد الآن">
            <div className="pulse">
              <div className="pulse-copy">
                <h2>الجديد الآن</h2>
                <span className="meta">
                  {stream.pulse.todayCount > 0
                    ? `نُشرت ${toLatinDigits(String(stream.pulse.todayCount))} مادة خلال 24 ساعة`
                    : "آخر ما نُشر"}
                  {stream.pulse.lastAt && relativeTimeAr(stream.pulse.lastAt) ? `، آخرها ${relativeTimeAr(stream.pulse.lastAt)}` : ""}
                </span>
              </div>
              <div className="pulse-line" aria-hidden="true">
                {stream.pulse.hours.map((count, hour) => (
                  <i
                    key={hour}
                    className={hour === stream.pulse.nowHour ? "is-now" : count > 0 ? "is-on" : undefined}
                    style={{ height: `${Math.min(22, 4 + count * 6)}px` }}
                  />
                ))}
              </div>
            </div>
            <NewsRiver initial={riverItems} exclude={[...shownIds]} />
          </section>
        ) : null}

        {/* اسأل العلم — يلي النهر مباشرة */}
        <HomeAskBand />

        {/* وراء الخبر — جوهر المنتج، يأتي قبل تدفق الأقسام العام. */}
        {contextFeatured || contextRows.length > 0 ? (
          <section className="sh-section" aria-label="وراء الخبر">
            <div className="section-head">
              <h2>وراء الخبر</h2>
              <span className="sub">قراءة أهدأ للصورة الكاملة</span>
              <Link className="more" href="/politics">الأرشيف</Link>
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
                          <Image src={story.image} alt="" width={132} height={92} />
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
          </section>
        ) : null}

        {/* الأقسام — شبكة تحريرية واضحة بدل سلسلة طويلة من الكتل المتشابهة. */}
        {stream && stream.panels.length > 0 ? (
          <section className="panels" aria-labelledby="sections-title">
            <div className="section-head panels-overview">
              <h2 id="sections-title">في الأقسام</h2>
              <span className="sub">أحدث القصص مرتبة حسب المجال</span>
            </div>
            <div className="panels-grid">
              {stream.panels.filter(panel => taxonomy.sections.some(item => item.slug === panel.slug)).map((panel) => (
                <div className="panel" key={panel.slug} style={{ "--pc": panel.color } as React.CSSProperties}>
                  <div className="panel-head">
                    <h3><Link className="story-link" href={`/${panel.slug}`}>{panel.name}</Link></h3>
                    <span className="meta">
                      {panel.todayCount > 0 ? `${toLatinDigits(String(panel.todayCount))} جديدة خلال 24 ساعة` : "أحدث ما في القسم"}
                    </span>
                    <Link className="more" href={`/${panel.slug}`} aria-label={`كل مواد ${panel.name}`}>كل القسم</Link>
                  </div>
                  <div className="panel-body">
                    {panel.lead ? (
                      <article className="panel-lead" data-story-id={panel.lead.id}>
                        {panel.lead.image ? (
                          <div className="panel-lead-media">
                            <Link className="soft-img" href={storyHref(panel.lead)} aria-hidden="true" tabIndex={-1}>
                              <Image src={panel.lead.image} alt="" fill sizes="(max-width: 720px) 100vw, 560px" />
                            </Link>
                            <div className="panel-lead-overlay">
                              <LeadHead story={panel.lead} />
                            </div>
                          </div>
                        ) : (
                          <LeadHead story={panel.lead} />
                        )}
                      </article>
                    ) : null}
                    <div className="panel-rows">
                      {panel.rows.map((story) => (
                        <article className="panel-row" key={story.id} data-story-id={story.id}>
                          <Kick story={story} />
                          <h3><Link className="story-link" href={storyHref(story)}>{story.title}</Link></h3>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* معرض الإنفوجرافيك */}
        {stream && stream.infographics.length > 0 ? (
          <section className="sh-section sh-infographics" aria-label="إنفوجرافيك">
            <div className="section-head">
              <h2>إنفوجرافيك</h2>
              <span className="sub">البيانات مرسومة</span>
              <Link className="more" href="/infographics">كل الإنفوجرافيك</Link>
            </div>
            <InfographicGallery
              items={stream.infographics.map((story) => ({
                id: story.id, href: storyHref(story), title: story.title, image: story.image as string,
                kick: seriesOf(story)?.name ?? sectionName(story.section),
              }))}
            />
          </section>
        ) : null}

        {/* بالأرقام */}
        {home.numbers.length > 0 ? (
          <section className="sh-section sh-figures" aria-label="بالأرقام">
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
                    المصدر
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* السلاسل — عمود العلم الفقري، بلاطات بلون كل سلسلة */}
        <section className="sh-section" aria-label="السلاسل">
          <div className="section-head">
            <h2>السلاسل</h2>
            <span className="sub">زوايا متعددة لفهم الخبر</span>
            <Link className="more" href="/series">كل السلاسل</Link>
          </div>
          <div className="sh-series">
            {home.series.filter(series => taxonomy.series.some(item => item.slug === series.slug)).map((series) => {
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
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>

        {/* مرئي وصوتي + مختارات من الأرشيف */}
        <div className="home-two">
          {home.videos.length > 0 ? (
            <div className="home-media">
              <div className="section-head">
                <h2>مرئي وصوتي</h2>
                <Link className="more" href="/videos">كل الوسائط</Link>
              </div>
              <section className="media-grid" aria-label="مرئي وصوتي">
                {home.videos.slice(0, 2).map((story) => (
                  <VideoCard key={story.id} story={story} />
                ))}
              </section>
            </div>
          ) : null}
          {mostRead.length > 0 ? (
            <section className="most-read" aria-label="مختارات من الأرشيف">
              <div className="section-head">
                <h2>مختارات من الأرشيف</h2>
              </div>
              <ol className="most-read-list">
                {mostRead.map((story, index) => (
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

      <SeriesSpectrum className="home-spectrum" />
      <SiteFooter />
    </>
  );
}
