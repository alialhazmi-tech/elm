import Link from "next/link";

import { getBreaking } from "@/lib/content/provider";
import { SERIES } from "@/lib/content/series";
import { brandDate, riyadhDateISO, toLatinDigits } from "@/lib/format";
import { NewsletterForm } from "./newsletter-form";
import { SeriesRail } from "./series-navigator";
import { ThemeToggle } from "./theme-toggle";
import { MemberEntry } from "./member-entry";

/**
 * الهيدر من طبقتين (تصميم 2026-09-01):
 * الصف الأول: الشعار، الأقسام مسطّحة بلا قائمة منسدلة، ثم الأشكال، ثم حقل «ابحث أو اسأل العلم» والثيم والدخول.
 * الشريط الثاني: «تغطية مستمرة» + العاجل + التاريخ يمينًا، ومسطرة السلاسل الثماني يسارًا — يلتصق وحده عند التمرير.
 * كان القارئ يقطع أربعة أشرطة (≈188px) قبل أول خبر؛ صار يقطع اثنين (≈108px).
 */

/** الأقسام السبعة الظاهرة في الصف الأول — «ثقافة» في قائمة الجوال والفوتر. */
const NAV_SECTIONS = [
  { label: "محليات", href: "/politics" },
  { label: "اقتصاد", href: "/economy" },
  { label: "تقنية", href: "/technology" },
  { label: "علوم", href: "/sciences" },
  { label: "صحة", href: "/health" },
  { label: "رياضة", href: "/sport" },
  { label: "عالم", href: "/world" },
];

/** الأشكال — بعد فاصل رفيع وبلون أهدأ. */
const NAV_FORMATS = [
  { label: "إنفوجرافيك", href: "/infographics" },
  { label: "بودكاست", href: "/podcasts" },
  { label: "فيديو", href: "/videos" },
];

const MOBILE_NAV = [
  { label: "الرئيسية", href: "/" },
  { label: "السلاسل", href: "/series" },
  ...NAV_FORMATS,
  ...NAV_SECTIONS,
  { label: "ثقافة", href: "/culture" },
];

const FOOTER_SECTIONS = [
  { label: "محليات وسياق", href: "/politics" },
  { label: "اقتصاد واستثمار", href: "/economy" },
  { label: "تقنية وذكاء اصطناعي", href: "/technology" },
  { label: "علوم ومعرفة", href: "/sciences" },
  { label: "صحة وجودة حياة", href: "/health" },
  { label: "رياضة وصناعة", href: "/sport" },
  { label: "ثقافة وفكر", href: "/culture" },
  { label: "عالم وجيوسياسة", href: "/world" },
  { label: "منوعات وظواهر", href: "/varieties" },
];

const FOOTER_FORMATS = [
  { label: "إنفوجرافيك وبيانات", href: "/infographics" },
  { label: "مرئي ووثائقي", href: "/videos" },
  { label: "بودكاست العلم", href: "/podcasts" },
  { label: "البحث التحريري", href: "/search" },
];

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

/**
 * الشريط الثاني: العاجل الساري يتقدّم (أحمر للساعة الأولى من مادة مُعلَّمة)،
 * وإلا أحدث مادة منشورة تحت «تغطية مستمرة» حتى يبقى الصف حيًا.
 * التاريخ الهجري والميلادي يجلسان هنا بدل سطر مستقل في الصفحة.
 */
async function TopStrip({ rail, activeSeries }: { rail?: boolean; activeSeries?: string }) {
  const breaking = await getBreaking().catch(() => null);
  const today = brandDate(new Date().toISOString());
  const urgent = Boolean(breaking?.urgent);
  const label = breaking?.label ?? "";
  const tag = urgent ? "عاجل" : label;

  return (
    <div className={rail ? "topstrip has-rail" : "topstrip"}>
      <div className="topstrip-inner">
        <div className={urgent ? "strip-news is-urgent" : "strip-news"} role="status" aria-label={urgent ? "خبر عاجل" : "تغطية مستمرة"}>
          <span className="strip-live">
            <span className="strip-dot" aria-hidden="true" />
            {urgent ? "عاجل" : "تغطية مستمرة"}
          </span>
          {breaking ? (
            <Link className="strip-title" href={breaking.href}>
              {urgent ? null : (
                <>
                  <b className="strip-tag">{tag}</b>
                  <span aria-hidden="true"> · </span>
                </>
              )}
              {breaking.title}
            </Link>
          ) : null}
          <time className="strip-date" dateTime={riyadhDateISO()}>
            <span className="hijri">
              {toLatinDigits(today.hijri)}
              <span aria-hidden="true"> · </span>
            </span>
            {toLatinDigits(today.gregorian)}
          </time>
        </div>
        {rail ? <SeriesRail series={SERIES.filter((item) => !item.archived).slice(0, 8)} active={activeSeries} /> : null}
      </div>
    </div>
  );
}

export async function SiteHeader({
  active,
  activeSeries,
  rail,
}: {
  active?: string;
  activeSeries?: string;
  /** مسطرة السلاسل في الشريط الثاني — الرئيسية وحدها. */
  rail?: boolean;
}) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/" aria-label="العلم - الصفحة الرئيسية">
            <span className="brand-word">العلم</span>
          </Link>

          <nav className="topnav" aria-label="التنقل الرئيسي">
            {NAV_SECTIONS.map((item) => (
              <Link key={item.href} href={item.href} className={item.href === active ? "is-active" : undefined}>
                {item.label}
              </Link>
            ))}
            <span className="topnav-sep" aria-hidden="true" />
            {NAV_FORMATS.map((item) => (
              <Link key={item.href} href={item.href} className={item.href === active ? "is-format is-active" : "is-format"}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="top-tools">
            <Link className="ask-field" href="/search" aria-label="ابحث أو اسأل العلم">
              <SearchIcon />
              <span className="ask-field-text">ابحث أو اسأل العلم…</span>
              <kbd aria-hidden="true">⌘K</kbd>
            </Link>
            <ThemeToggle />
            <MemberEntry />
            <details className="mnav">
              <summary aria-label="القائمة">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              </summary>
              <nav className="mobile-nav" aria-label="التنقل الرئيسي للجوال">
                {MOBILE_NAV.map((item) => (
                  <Link key={item.href} href={item.href} className={active === item.href ? "is-active" : undefined}>
                    {item.label}
                  </Link>
                ))}
                <span className="mnav-lbl">السلاسل</span>
                {SERIES.map((item) => (
                  <Link key={item.slug} href={`/series/${item.slug}`} style={{ "--sc": item.color } as React.CSSProperties} className="mnav-series">
                    {item.name}
                  </Link>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>
      {/* خارج الهيدر حتى يلتصق وحده عند التمرير ولا يُسحب معه */}
      <TopStrip rail={rail} activeSeries={activeSeries} />
      {/* رقائق السلاسل على الجوال في كل الصفحات — بديل المسطرة التي تختفي هناك */}
      <nav className="sx-switch top-series-mobile" aria-label="السلاسل">
        <Link href="/series" className="sx-all">كل السلاسل</Link>
        {SERIES.map((item) => (
          <Link
            key={item.slug}
            href={`/series/${item.slug}`}
            className={item.slug === activeSeries ? "is-active" : undefined}
            style={{ "--sc": item.color } as React.CSSProperties}
          >
            {item.name}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-shell">
        <div className="footer-grid">
          {/* العمود الأول: الهوية والرسالة */}
          <div className="ft-col ft-col-brand">
            <Link href="/" className="brand-word ft-brand-word" aria-label="العلم - الصفحة الرئيسية">
              العلم
            </Link>
            <p className="ft-tagline">
              منصة إعلام ومعرفة سعودية تضع الخبر في سياقه، وتفكك الأحداث عبر السلاسل التفسيرية وصحافة البيانات والتحليل المعمّق.
            </p>
            <div className="ft-pills">
              <span className="ft-pill-item">صحافة سياق</span>
              <span className="ft-pill-item">بيانات موثقة</span>
              <span className="ft-pill-item">بلا ضوضاء</span>
            </div>
          </div>

          {/* العمود الثاني: سلاسل المعرفة */}
          <div className="ft-col">
            <h3 className="ft-head">السلاسل</h3>
            <ul className="ft-nav-list ft-series-list">
              {SERIES.slice(0, 8).map((item) => (
                <li key={item.slug}>
                  <Link href={`/series/${item.slug}`} className="ft-series-link">
                    <span className="ft-dot" style={{ backgroundColor: item.color }} aria-hidden="true" />
                    <span className="ft-series-name">{item.name}</span>
                    <small className="ft-series-sub">{item.description}</small>
                  </Link>
                </li>
              ))}
            </ul>
            <Link className="ft-all-series" href="/series">
              كل السلاسل والأرشيف <span aria-hidden="true">←</span>
            </Link>
          </div>

          {/* العمود الثالث: الأقسام والتغطيات */}
          <div className="ft-col">
            <h3 className="ft-head">الأقسام</h3>
            <ul className="ft-nav-list ft-cols">
              {FOOTER_SECTIONS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
              {FOOTER_FORMATS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* العمود الرابع: النشرة البريدية */}
          <div className="ft-col ft-col-newsletter">
            <h3 className="ft-head">نشرة «ما وراء العناوين»</h3>
            <p className="ft-newsletter-sub">
              موجز أسبوعي يختصر أهم ما نشره محررونا في بريدك — بقراءة هادئة بلا إعلانات.
            </p>
            <NewsletterForm source="footer" />
          </div>
        </div>

        <div className="footer-legal">
          <div className="ft-legal-right">
            <span>© {year} العلم — جميع الحقوق محفوظة</span>
            <span className="ft-sep" aria-hidden="true">·</span>
            <span>المحتوى من مواد منشورة · المصدر النهائي «تحرير العلم»</span>
          </div>
          <div className="ft-legal-left">
            <Link href="/robots.txt">سياسة النشر</Link>
            <span className="ft-sep" aria-hidden="true">·</span>
            <Link href="/sitemap.xml">خريطة المنصة</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
