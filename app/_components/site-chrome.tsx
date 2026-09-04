import Link from "next/link";

import { getNewsStrip } from "@/lib/content/provider";
import { SERIES } from "@/lib/content/series";
import { NewsletterForm } from "./newsletter-form";
import { NewsStrip } from "./news-strip";
import { SeriesRail } from "./series-navigator";
import { ThemeToggle } from "./theme-toggle";
import { MemberEntry } from "./member-entry";

/** الأقسام — تحت «الأخبار» في قائمة منسدلة. */
const SECTIONS = [
  { label: "محليات", href: "/politics" },
  { label: "اقتصاد", href: "/economy" },
  { label: "تقنية", href: "/technology" },
  { label: "علوم", href: "/sciences" },
  { label: "صحة", href: "/health" },
  { label: "رياضة", href: "/sport" },
  { label: "ثقافة", href: "/culture" },
  { label: "عالم", href: "/world" },
  { label: "إنفوجرافيك", href: "/infographics" },
];

const MOBILE_NAV = [
  { label: "الرئيسية", href: "/" },
  { label: "السلاسل", href: "/series" },
  { label: "إنفوجرافيك", href: "/infographics" },
  { label: "بودكاست", href: "/podcasts" },
  { label: "فيديو", href: "/videos" },
  ...SECTIONS.filter((item) => item.href !== "/infographics"),
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


/**
 * شريط الأخبار: العاجل الساري يتقدّم، ثم تتناوب أحدث المواد المنشورة.
 */
async function BreakingBar() {
  const items = await getNewsStrip(5).catch(() => []);
  return <NewsStrip items={items.map(({ title, href, urgent }) => ({ title, href, urgent }))} />;
}

/**
 * الهيدر: لوح مداد، اللوجوتايب السالب (كلمة «العلم» وحدها —
 * Noto Kufi ‏900)، والنشط بتمييز كحلي فاتح دون أحمر.
 */
function Caret() {
  return (
    <svg className="caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * الهيدر: صف واحد رحب — شعار كبير يمينًا، قائمة بأسهم منسدلة هادئة،
 * ويسارًا زر دخول مملوء واحد وأيقونات بسيطة بلا خلفيات.
 */
export async function SiteHeader({
  active,
  activeSeries,
  rail,
}: {
  active?: string;
  activeSeries?: string;
  /** مسطرة السلاسل تحت الهيدر — الرئيسية وحدها، تلتصق وحدها إذا تحركت الصفحة. */
  rail?: boolean;
}) {
  const sectionActive = SECTIONS.some((item) => item.href === active);
  const seriesActive = active === "/series";

  return (
    <>
      <header className={rail ? "topbar has-rail" : "topbar"}>
        <div className="topbar-inner">
          <Link className="brand" href="/" aria-label="العلم - الصفحة الرئيسية">
            <span className="brand-word">العلم</span>
          </Link>

          <nav className="topnav" aria-label="التنقل الرئيسي">
            <div className="nav-item has-menu">
              <Link href="/politics" className={sectionActive ? "is-active" : undefined} aria-haspopup="true">
                الأخبار <Caret />
              </Link>
              <div className="nav-panel" role="menu">
                {SECTIONS.filter((item) => item.href !== "/infographics").map((item) => (
                  <Link key={item.href} href={item.href} role="menuitem" className={item.href === active ? "is-active" : undefined}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="nav-item has-menu">
              <Link href="/series" className={seriesActive ? "is-active" : undefined} aria-haspopup="true">
                السلاسل <Caret />
              </Link>
              <div className="nav-panel nav-panel-series" role="menu">
                {SERIES.map((item) => (
                  <Link key={item.slug} href={`/series/${item.slug}`} role="menuitem" style={{ "--sc": item.color } as React.CSSProperties}>
                    <i className="dot" aria-hidden="true" />
                    <span>{item.name}</span>
                    <small>{item.description}</small>
                  </Link>
                ))}
                <Link href="/series" role="menuitem" className="nav-all">كل السلاسل ←</Link>
              </div>
            </div>
            <Link href="/infographics" className={active === "/infographics" ? "is-active" : undefined}>إنفوجرافيك</Link>
            <Link href="/podcasts" className={active === "/podcasts" ? "is-active" : undefined}>بودكاست</Link>
            <Link href="/videos" className={active === "/videos" ? "is-active" : undefined}>فيديو</Link>
          </nav>

          <div className="top-tools">
            <Link className="icon-btn" href="/search" aria-label="ابحث أو اسأل العلم">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
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
      <BreakingBar />
      {/* خارج الهيدر حتى يلتصق وحده عند التمرير ولا يُسحب معه.
          على الرئيسية تُغني عنه مسطرة السلاسل التي تبقى ظاهرة على الجوال. */}
      {rail ? null : (
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
      )}
      {rail ? <SeriesRail series={SERIES.filter((item) => !item.archived).slice(0, 8)} /> : null}
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
              ابقَ قريبًا من المعرفة؛ أبرز مواد «العلم» تصلك أسبوعيًا عبر البريد.
            </p>
            <NewsletterForm source="footer" />
          </div>
        </div>

        <div className="footer-legal">
          <div className="ft-legal-right">
            <span>© {year} العلم — جميع الحقوق محفوظة</span>
          </div>
          <div className="ft-legal-left">
            <Link href="/about">من نحن</Link>
            <span className="ft-sep" aria-hidden="true">·</span>
            <Link href="/contact">تواصل معنا</Link>
            <span className="ft-sep" aria-hidden="true">·</span>
            <Link href="/privacy-policy">سياسة الخصوصية</Link>
            <span className="ft-sep" aria-hidden="true">·</span>
            <Link href="/sitemap.xml">خريطة المنصة</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
