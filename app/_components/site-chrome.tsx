import Link from "next/link";

import { BrandMark } from "./brand-mark";
import { getNewsStrip } from "@/lib/content/provider";
import { SERIES } from "@/lib/content/series";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { NewsletterForm } from "./newsletter-form";
import { NewsStrip } from "./news-strip";
import { SeriesRail } from "./series-navigator";
import { ThemeToggle } from "./theme-toggle";
import { MemberEntry } from "./member-entry";
import { MobileNavigation } from "./mobile-navigation";
import { FooterNavigation } from "./footer-navigation";

/** الأقسام — تحت «الأخبار» في قائمة منسدلة. */
const SECTIONS = [
  { label: "سياسة", href: "/politics" },
  { label: "اقتصاد", href: "/economy" },
  { label: "تقنية", href: "/technology" },
  { label: "علوم", href: "/sciences" },
  { label: "صحة", href: "/health" },
  { label: "رياضة", href: "/sport" },
  { label: "ثقافة", href: "/culture" },
  { label: "عالم", href: "/world" },
  { label: "منوعات", href: "/varieties" },
];

const FORMATS = [
  { label: "إنفوجرافيك", href: "/infographics" },
  { label: "بودكاست", href: "/podcasts" },
  { label: "فيديو", href: "/videos" },
];

/**
 * شريط الأخبار: العاجل الساري يتقدّم، ثم تتناوب أحدث المواد المنشورة.
 */
async function BreakingBar() {
  const items = await getNewsStrip(5).catch(() => []);
  return <NewsStrip items={items.map(({ title, href, urgent }) => ({ title, href, urgent }))} />;
}

/**
 * الهيدر: اللوقو الرسمي الهندسي، والنشط بتمييز كحلي دون أحمر.
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
 * ويسارًا أدوات البحث والمظهر والقائمة.
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
            <BrandMark variant="official" />
          </Link>

          <nav className="topnav" aria-label="التنقل الرئيسي">
            <div className="nav-item has-menu">
              <Link href="/politics" className={sectionActive ? "is-active" : undefined} aria-haspopup="true">
                الأخبار <Caret />
              </Link>
              <div className="nav-panel" role="menu">
                {SECTIONS.map((item) => (
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
            <MobileNavigation>
              <Link className="site-drawer-home" href="/" aria-current={active === "/" ? "page" : undefined}>الرئيسية <span aria-hidden="true">←</span></Link>
              <section className="site-drawer-section" aria-label="الأقسام">
                <h3>الأقسام</h3>
                <div className="site-drawer-grid">
                  {SECTIONS.map((item) => <Link key={item.href} href={item.href} aria-current={active === item.href ? "page" : undefined}>{item.label}</Link>)}
                </div>
              </section>
              <section className="site-drawer-section" aria-label="السلاسل">
                <div className="site-drawer-section-heading"><h3>السلاسل</h3><Link href="/series">كل السلاسل <span aria-hidden="true">←</span></Link></div>
                <div className="site-drawer-grid">
                  {SERIES.map((item) => <Link key={item.slug} href={`/series/${item.slug}`} aria-current={activeSeries === item.slug ? "page" : undefined}>
                    <i className="site-drawer-dot" style={{ background: item.color }} aria-hidden="true" />{item.name}
                  </Link>)}
                </div>
              </section>
              <section className="site-drawer-section" aria-label="مرئي وصوتي">
                <h3>مرئي وصوتي</h3>
                <div className="site-drawer-grid">
                  {FORMATS.map((item) => <Link key={item.href} href={item.href} aria-current={active === item.href ? "page" : undefined}>{item.label}</Link>)}
                </div>
              </section>
            </MobileNavigation>
            <Link className="icon-btn" href="/search" aria-label="ابحث في العلم">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            </Link>
            <ThemeToggle />
            <MemberEntry />

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
      {rail ? <SeriesRail series={SERIES} /> : null}
    </>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer id="site-footer" className="footer footer-site">
      <div className="footer-shell">
        <div className="footer-intro">
          <div className="ft-col-brand">
            <Link href="/" className="ft-brand" aria-label="العلم - الصفحة الرئيسية">
              <BrandMark variant="official" />
            </Link>
            <p className="ft-tagline">
              منصة إعلام ومعرفة سعودية تضع الخبر في سياقه، وتفكك الأحداث عبر السلاسل التفسيرية وصحافة البيانات والتحليل المعمّق.
            </p>
          </div>
          <div className="ft-col-newsletter">
            <h3 className="ft-head">نشرة «ما وراء العناوين»</h3>
            <p className="ft-newsletter-sub">
              سجّل بريدك في قائمة نشرة «العلم» لتصلك الإصدارات عند إطلاقها.
            </p>
            <NewsletterForm source="footer" />
          </div>
        </div>

        <FooterNavigation>
          <details className="footer-link-group" open>
            <summary><h3>الأقسام</h3><Caret /></summary>
            <ul className="ft-nav-list ft-cols">
              {SECTIONS.map((item) => <li key={item.href}><Link href={item.href}>{item.label}</Link></li>)}
            </ul>
          </details>
          <details className="footer-link-group" open>
            <summary><h3>السلاسل</h3><Caret /></summary>
            <ul className="ft-nav-list ft-cols">
              {SERIES.map((item) => <li key={item.slug}>
                <Link href={`/series/${item.slug}`} className="ft-series-link">
                  <span className="ft-dot" style={{ backgroundColor: item.color }} aria-hidden="true" />{item.name}
                </Link>
              </li>)}
            </ul>
            <Link className="ft-all-series" href="/series">كل السلاسل والأرشيف</Link>
          </details>
          <details className="footer-link-group" open>
            <summary><h3>مرئي وصوتي</h3><Caret /></summary>
            <ul className="ft-nav-list">
              {FORMATS.map((item) => <li key={item.href}><Link href={item.href}>{item.label}</Link></li>)}
              <li><Link href="/search">البحث</Link></li>
            </ul>
          </details>
        </FooterNavigation>

        <nav className="ft-social" aria-label="حسابات العلم على منصات التواصل" dir="rtl">
          <h3 className="ft-head">تابع العلم</h3>
          <ul className="ft-social-links">
            {SOCIAL_LINKS.map(({ id, label, href }) => (
              <li key={id}>
                <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`العلم على ${label} — يفتح في تبويب جديد`} title={label}>
                  <span className="ft-social-icon" aria-hidden="true" style={{ maskImage: `url(/social/${id}.svg)`, WebkitMaskImage: `url(/social/${id}.svg)` }} />
                </a>
              </li>
            ))}
          </ul>
        </nav>

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
