import Link from "next/link";

import { getBreaking } from "@/lib/content/provider";
import { SERIES } from "@/lib/content/series";
import { NewsletterForm } from "./newsletter-form";
import { ThemeToggle } from "./theme-toggle";
import { MemberEntry } from "./member-entry";

// «السلاسل» خرجت من القائمة العلوية — مسطرة السلاسل تحت الهيدر تغني عنها.
const NAV = [
  { label: "الرئيسية", href: "/" },
  { label: "محليات", href: "/politics" },
  { label: "اقتصاد", href: "/economy" },
  { label: "تقنية", href: "/technology" },
  { label: "علوم", href: "/sciences" },
  { label: "صحة", href: "/health" },
  { label: "رياضة", href: "/sport" },
  { label: "مرئي", href: "/videos" },
];

const MOBILE_NAV = [
  { label: "الرئيسية", href: "/" },
  { label: "السلاسل", href: "/series" },
  { label: "محليات", href: "/politics" },
  { label: "اقتصاد", href: "/economy" },
  { label: "تقنية", href: "/technology" },
  { label: "علوم", href: "/sciences" },
  { label: "صحة", href: "/health" },
  { label: "رياضة", href: "/sport" },
  { label: "ثقافة", href: "/culture" },
  { label: "عالم", href: "/world" },
  { label: "إنفوجرافيك", href: "/infographics" },
  { label: "مرئي", href: "/videos" },
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
  { label: "البحث التحريري", href: "/search" },
];


/**
 * شريط العاجل المطور (قرار المالك 2026-08-11): رفيع وساكن بلا زحف،
 * نبضة ضوئية هادئة، يظهر فقط ما دامت الصلاحية سارية ويختفي وحده —
 * الصلاحية يضبطها المعتمد في «تحرير العلم» (الافتراضي ساعتان).
 */
async function BreakingBar() {
  const breaking = await getBreaking().catch(() => null);
  if (!breaking) return null;

  return (
    <div className="breaking" role="status" aria-label="خبر عاجل">
      <div className="breaking-inner">
        <span className="breaking-dot" aria-hidden="true" />
        <span className="breaking-tag">عاجل</span>
        <Link className="breaking-title" href={breaking.href}>
          {breaking.title}
        </Link>
      </div>
    </div>
  );
}

/**
 * الهيدر: لوح مداد، اللوجوتايب السالب (كلمة «العلم» وحدها —
 * Noto Kufi ‏900)، والنشط بتمييز كحلي فاتح دون أحمر.
 */
export async function SiteHeader({ active }: { active?: string }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href="/" aria-label="العلم - الصفحة الرئيسية">
          <span className="brand-word">العلم</span>
          <span className="brand-tag">المعرفة بسلاسة</span>
        </Link>
        <nav className="topnav" aria-label="التنقل الرئيسي">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={active === item.href ? "is-active" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="top-tools">
          <Link className="ask-pill" href="/search" aria-label="البحث في العلم">
            <span className="spark" aria-hidden="true">✦</span>
            <span className="hint">ابحث أو اسأل العلم…</span>
            <kbd>⌘K</kbd>
          </Link>
          <ThemeToggle />
          <MemberEntry />
        </div>
      </div>
      <nav className="mobile-nav" aria-label="التنقل الرئيسي للجوال">
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={active === item.href ? "is-active" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <BreakingBar />
    </header>
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
