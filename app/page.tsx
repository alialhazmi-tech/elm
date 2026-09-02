import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { InfographicGallery } from "@/app/_components/home-stream";
import { BriefListen } from "@/app/_components/home-brief-listen";
import { homeStream, type SectionPanel } from "@/lib/content/homeStream";
import { formatReadingMinutes, relativeTimeAr, toLatinDigits } from "@/lib/format";
import { listByFormat, sectionName, seedContentProvider, seriesDirectory, seriesOf } from "@/lib/content/provider";
import { podcastShowFor } from "@/lib/podcasts";
import { storyHref, type Story } from "@/lib/content/types";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "العلم | المعرفة وراء الخبر",
  description:
    "منصة إعلام ومعرفة سعودية تشرح ما وراء الخبر عبر السلاسل والبيانات والفيديو والبودكاست.",
  alternates: { canonical: "/" },
};

/**
 * الرئيسية — تصميم 2026-09-01 (لوحة «رئيسية العلم — التصور المقترح»):
 * الصدارة + موجز العلم → حزام السلاسل الثماني → اسأل العلم → الأقسام بثلاثة إيقاعات
 * (قائدة بصورة + قائمة، ثلاث بطاقات، عمودان مضغوطان) → إنفوجرافيك → بالأرقام → اسمع وشاهد.
 * لا يتكرر خبر مرتين: كل ما يُعرض فوق يُستبعد مما تحته (data-story-id عقد يفحصه الاختبار).
 */

const trimExcerpt = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

/** معرّف المادة من رابطها المقدس /{section}/{id}/{slug} — الموجز يحمل الروابط لا المعرّفات. */
const idFromHref = (href: string): string | undefined => href.split("/")[2];

/** سطر السلسلة/القسم بنقطة ملونة — يُستخدم في كل بطاقات الرئيسية. */
function Kick({ story, when }: { story: Story; when?: boolean }) {
  const series = seriesOf(story);
  const ago = when ? relativeTimeAr(story.publishedAt) : null;
  return (
    <span className="kick" style={{ "--kc": series?.color } as React.CSSProperties}>
      {series?.name ?? sectionName(story.section)}
      {series ? <span className="sect">· {sectionName(story.section)}</span> : null}
      {ago ? <span className="sect">· {ago}</span> : null}
    </span>
  );
}

function SectionHead({ title, sub, href, more }: { title: string; sub?: string; href?: string; more?: string }) {
  return (
    <div className="hm-head">
      <h2>
        {href ? <Link className="story-link" href={href}>{title}</Link> : title}
        {sub ? <span className="sub">{sub}</span> : null}
      </h2>
      {href ? <Link className="more" href={href}>{more ?? `كل ${title}`} <span aria-hidden="true">←</span></Link> : null}
    </div>
  );
}

/** صف نصي: كيكر + عنوان — وحدة القوائم في كل الإيقاعات. */
function Row({ story }: { story: Story }) {
  return (
    <article className="hm-row" data-story-id={story.id}>
      <Kick story={story} />
      <h3><Link className="story-link" href={storyHref(story)}>{story.title}</Link></h3>
    </article>
  );
}

/** الإيقاع الأول — محليات: قائدة بصورة وعنوان فوقها، وبجانبها أربعة صفوف. */
function FeaturedPanel({ panel }: { panel: SectionPanel }) {
  const lead = panel.lead;
  return (
    <section className="hm-sec" aria-label={panel.name} style={{ "--pc": panel.color } as React.CSSProperties}>
      <SectionHead title={panel.name} sub="أحدث ما في القسم" href={`/${panel.slug}`} />
      <div className="hm-feat">
        {lead ? (
          <article className="hm-feat-lead" data-story-id={lead.id}>
            {lead.image ? (
              <Link className="hm-feat-media" href={storyHref(lead)} aria-hidden="true" tabIndex={-1}>
                <Image src={lead.image} alt="" fill sizes="(max-width: 1040px) 100vw, 640px" />
              </Link>
            ) : null}
            <div className={lead.image ? "hm-feat-overlay" : "hm-feat-copy"}>
              <Kick story={lead} />
              <h3><Link className="story-link" href={storyHref(lead)}>{lead.title}</Link></h3>
            </div>
          </article>
        ) : null}
        <div className="hm-rows">
          {panel.rows.map((story) => <Row key={story.id} story={story} />)}
        </div>
      </div>
    </section>
  );
}

/** الإيقاع الثاني — اقتصاد: ثلاث بطاقات بصور. */
function CardsPanel({ panel }: { panel: SectionPanel }) {
  const pool = [panel.lead, ...panel.rows].filter((s): s is Story => s !== null);
  const withImage = pool.filter((s) => s.image);
  const cards = [...withImage, ...pool.filter((s) => !s.image)].slice(0, 3);
  return (
    <section className="hm-sec" aria-label={panel.name} style={{ "--pc": panel.color } as React.CSSProperties}>
      <SectionHead title={panel.name} sub="أحدث ما في القسم" href={`/${panel.slug}`} />
      <div className="hm-cards">
        {cards.map((story) => (
          <article className="hm-card" key={story.id} data-story-id={story.id}>
            {story.image ? (
              <Link className="hm-card-media" href={storyHref(story)} aria-hidden="true" tabIndex={-1}>
                <Image src={story.image} alt="" fill sizes="(max-width: 640px) 96px, (max-width: 1040px) 50vw, 400px" />
              </Link>
            ) : null}
            <div className="hm-card-body">
              <Kick story={story} />
              <h3><Link className="story-link" href={storyHref(story)}>{story.title}</Link></h3>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** الإيقاع الثالث — بطاقة قسم أنيقة وناعمة: مادة قائدة بمصغّر صورة + صفوف فرعية. */
function ListPanel({ panel }: { panel: SectionPanel }) {
  const lead = panel.lead ?? panel.rows[0] ?? null;
  const secondary = (panel.lead ? panel.rows : panel.rows.slice(1)).slice(0, 3);
  return (
    <section className="hm-list" aria-label={panel.name} style={{ "--pc": panel.color } as React.CSSProperties}>
      <SectionHead title={panel.name} href={`/${panel.slug}`} />
      {lead ? (
        <article className="hm-list-lead" data-story-id={lead.id}>
          {lead.image ? (
            <Link className="hm-list-lead-media" href={storyHref(lead)} aria-hidden="true" tabIndex={-1}>
              <Image src={lead.image} alt="" fill sizes="(max-width: 640px) 100vw, 240px" />
            </Link>
          ) : null}
          <div className="hm-list-lead-body">
            <Kick story={lead} />
            <h3><Link className="story-link" href={storyHref(lead)}>{lead.title}</Link></h3>
            {lead.excerpt ? <p className="hm-list-lead-dek">{trimExcerpt(lead.excerpt, 100)}</p> : null}
          </div>
        </article>
      ) : null}
      {secondary.length > 0 ? (
        <div className="hm-rows">
          {secondary.map((story) => <Row key={story.id} story={story} />)}
        </div>
      ) : null}
    </section>
  );
}

export default async function Home() {
  const [home, directory, podcasts] = await Promise.all([
    seedContentProvider.getHome(),
    seriesDirectory().catch(() => ({} as Awaited<ReturnType<typeof seriesDirectory>>)),
    listByFormat("podcasts", 6).catch(() => [] as Story[]),
  ]);
  const hero = home.hero;

  // كل ما يظهر في الصدارة والموجز يُستبعد من لوحات الأقسام حتى لا يتكرر خبر في الصفحة.
  const shownIds = new Set<string>(
    [hero?.id, ...home.brief.map((item) => idFromHref(item.href))].filter((id): id is string => Boolean(id)),
  );
  const stream = await homeStream(shownIds).catch(() => null);
  const panels = stream?.panels ?? {};
  // الإيقاع الثالث: الأقسام المتاحة من الأربعة تُرصّ عمودين عمودين؛ الفردي يمتد بعرض الصف.
  const listPanels = [panels.technology, panels.health, panels.sport, panels.world].filter(
    (panel): panel is SectionPanel => Boolean(panel),
  );
  const listPairs = listPanels.reduce<SectionPanel[][]>((pairs, panel, index) => {
    if (index % 2 === 0) pairs.push([panel]);
    else pairs[pairs.length - 1].push(panel);
    return pairs;
  }, []);

  // موجز العلم: مدة الاستماع تُقدَّر من طول العناوين.
  const briefWords = home.brief.reduce((total, item) => total + item.title.trim().split(/\s+/).length, 0);
  const briefSeconds = Math.min(180, Math.max(30, Math.round((briefWords / 2.5) / 5) * 5));
  const briefUpdated = relativeTimeAr(
    home.brief.map((item) => item.publishedAt).filter(Boolean).sort().at(-1) ?? undefined,
  );

  // اسمع وشاهد: أحدث فيديو + برنامجان من البودكاست بأغلفتهما؛ وإن غابت الأغلفة فالفيديوان.
  const shows = podcasts.filter((story) => story.image).slice(0, 2);
  const videos = home.videos.slice(0, shows.length > 0 ? 1 : 2);
  const mediaCols = videos.length + shows.length;

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
      <SiteHeader active="/" rail />

      <main id="main-content" className="hm">
        {/* ١. الصدارة + موجز العلم */}
        <section className="hm-top" aria-label="الصدارة وموجز العلم">
          {hero ? (
            <article className="hm-hero" data-story-id={hero.id}>
              <div className="hm-hero-copy">
                <Kick story={hero} />
                <h1><Link className="story-link" href={storyHref(hero)}>{hero.title}</Link></h1>
                {hero.excerpt ? <p className="dek">{trimExcerpt(hero.excerpt, 200)}</p> : null}
                <div className="hm-hero-meta">
                  <Link className="hm-go" href={storyHref(hero)}>
                    {hero.series === "limatha" ? "اقرأ الإجابة" : "اقرأ المادة"} <span aria-hidden="true">←</span>
                  </Link>
                  <span className="meta">قراءة {formatReadingMinutes(hero.readingMinutes)} · تحرير: فريق العلم</span>
                </div>
              </div>
              {hero.image ? (
                <Link className="hm-hero-media" href={storyHref(hero)} aria-hidden="true" tabIndex={-1}>
                  <Image src={hero.image} alt="" fill sizes="(max-width: 1040px) 100vw, 420px" priority />
                </Link>
              ) : null}
            </article>
          ) : (
            <article className="hm-hero is-empty">
              <div className="hm-hero-copy">
                <h1>لا مواد منشورة بعد</h1>
                <p className="dek">الأرشيف يُجهَّز الآن. ستظهر المواد هنا فور اكتمال السحب.</p>
              </div>
            </article>
          )}

          {home.brief.length > 0 ? (
            <aside className="hm-brief" aria-labelledby="brief-title">
              <div className="hm-brief-head">
                <h2 id="brief-title"><span className="spark" aria-hidden="true">✦</span> موجز العلم</h2>
                <BriefListen lines={home.brief.map((item) => item.title)} seconds={briefSeconds} />
              </div>
              <ol className="hm-brief-list">
                {home.brief.map((item, index) => (
                  <li key={item.href}>
                    <span className="bno latin-number" dir="ltr" lang="en" aria-hidden="true">{toLatinDigits(String(index + 1))}</span>
                    <div className="bbody">
                      <span className="kick" style={{ "--kc": item.color } as React.CSSProperties}>{item.label}</span>
                      <h3><Link className="story-link" href={item.href}>{item.title}</Link></h3>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="hm-brief-foot">
                {briefUpdated ? `تحديث ${briefUpdated} · ` : ""}
                مُولَّد من {toLatinDigits(String(home.briefFrom))} مادة منشورة · يحيل كل عنوان إلى مادته
              </p>
            </aside>
          ) : null}
        </section>

        {/* ٢. حزام السلاسل الثماني — مباشرة بعد الصدارة */}
        <section className="hm-sec" aria-label="سلاسل العلم">
          <SectionHead title="سلاسل العلم" sub="ثماني طرق لفهم الخبر كاملًا" href="/series" more="كل السلاسل" />
          <div className="hm-series">
            {home.series.map((series) => {
              const entry = directory[series.slug];
              return (
                <Link
                  key={series.slug}
                  className="series-lens"
                  href={`/series/${series.slug}`}
                  style={{ "--sc": series.color } as React.CSSProperties}
                >
                  <span className="sname">
                    {series.name}
                    {entry?.count ? <small><span className="latin-number">{toLatinDigits(String(entry.count))}</span> مادة</small> : null}
                  </span>
                  <span className="slatest">{entry?.latest?.title ?? series.description}</span>
                  <span className="sgo">تصفح السلسلة <span aria-hidden="true">←</span></span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ٣. اسأل العلم */}
        <section className="hm-ask" aria-labelledby="ask-title">
          <div className="hm-ask-info">
            <h2 id="ask-title"><span className="spark" aria-hidden="true">✦</span> اسأل العلم</h2>
            <p>بحث ذكي يجيب من أرشيف موادنا — كل إجابة تحمل روابط مصادرها المنشورة.</p>
          </div>
          <div className="hm-ask-body">
            <form className="hm-ask-form" action="/search" role="search">
              <input type="search" name="q" placeholder="لماذا ترتفع أسعار التنجستن؟" aria-label="ابحث في العلم" dir="rtl" />
              <button type="submit">اسأل</button>
            </form>
            <p className="hm-ask-suggest">
              <span className="lbl">جرّب:</span>
              <Link href="/search?q=التنجستن">أسعار التنجستن</Link>
              <Link href="/search?q=تود بلانش">من هو تود بلانش؟</Link>
              <Link href="/search?q=الجاذبية">شائعة الجاذبية</Link>
              <span className="note">الإجابات مولّدة آليًا وتُراجع مصادرها قبل الاعتماد</span>
            </p>
          </div>
        </section>

        {/* ٤. الأقسام بثلاثة إيقاعات */}
        {panels.politics ? <FeaturedPanel panel={panels.politics} /> : null}
        {panels.economy ? <CardsPanel panel={panels.economy} /> : null}
        {listPairs.map((pair) => (
          <div className="hm-pair" key={pair.map((panel) => panel.slug).join("+")}>
            {pair.map((panel) => <ListPanel key={panel.slug} panel={panel} />)}
          </div>
        ))}

        {/* ٥. معرض الإنفوجرافيك */}
        {stream && stream.infographics.length > 0 ? (
          <section className="hm-sec" aria-label="إنفوجرافيك">
            <SectionHead title="إنفوجرافيك" sub="البيانات مرسومة" href="/infographics" more="كل الإنفوجرافيك" />
            <InfographicGallery
              items={stream.infographics.map((story) => ({
                id: story.id, href: storyHref(story), title: story.title, image: story.image as string,
                kick: seriesOf(story)?.name ?? sectionName(story.section),
              }))}
            />
          </section>
        ) : null}

        {/* ٦. بالأرقام */}
        {home.numbers.length > 0 ? (
          <section className="hm-sec" aria-label="بالأرقام">
            <SectionHead title="بالأرقام" sub="كل رقم يحيل إلى مصدره" />
            <div className="hm-stats">
              {home.numbers.slice(0, 3).map((stat) => (
                <div className="hm-stat" key={stat.label}>
                  <span className="big latin-number" dir="ltr" lang="en">
                    {toLatinDigits(stat.value)}
                    {stat.suffix ? <small>{toLatinDigits(stat.suffix)}</small> : null}
                  </span>
                  <p>{stat.label}</p>
                  <Link className="src" href={stat.href ?? "/infographics"}>المصدر <span aria-hidden="true">←</span></Link>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ٧. اسمع وشاهد */}
        {mediaCols > 0 ? (
          <section className="hm-sec" aria-label="اسمع وشاهد">
            <SectionHead title="اسمع وشاهد" sub="بودكاست العلم ومرئياته" href="/videos" more="كل الوسائط" />
            <div className="hm-media" data-cols={mediaCols}>
              {videos.map((video) => (
                <article className="hm-video" key={video.id} data-story-id={video.id}>
                  {video.image ? (
                    <Link className="hm-video-media" href={storyHref(video)} aria-hidden="true" tabIndex={-1}>
                      <Image src={video.image} alt="" fill sizes="(max-width: 1040px) 100vw, 620px" />
                    </Link>
                  ) : null}
                  <span className="hm-play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" /></svg>
                  </span>
                  <div className="hm-video-overlay">
                    <span className="kick" style={{ "--kc": "var(--gold)" } as React.CSSProperties}>مرئي <span className="sect">· {formatReadingMinutes(video.readingMinutes)}</span></span>
                    <h3><Link className="story-link" href={storyHref(video)}>{video.title}</Link></h3>
                  </div>
                </article>
              ))}
              {shows.map((story) => {
                const show = podcastShowFor(story.id);
                return (
                  <article className="hm-show" key={story.id} data-story-id={story.id} style={{ "--pc": show?.accent } as React.CSSProperties}>
                    <Link className="hm-show-cover" href={storyHref(story)} aria-hidden="true" tabIndex={-1}>
                      <Image src={story.image as string} alt="" fill sizes="(max-width: 640px) 64px, 300px" />
                    </Link>
                    <div className="hm-show-body">
                      <span className="kick" style={{ "--kc": show?.accent } as React.CSSProperties}>بودكاست</span>
                      <h3><Link className="story-link" href={storyHref(story)}>{show?.name ?? story.title}</Link></h3>
                      <span className="meta">استمع للحلقات <span aria-hidden="true">←</span></span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
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
