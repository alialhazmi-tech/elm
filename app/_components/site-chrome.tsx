import Link from "next/link";

import { getBreaking } from "@/lib/content/provider";
import { SERIES } from "@/lib/content/series";
import { NewsletterForm } from "./newsletter-form";
import { ThemeToggle } from "./theme-toggle";
import { MemberEntry } from "./member-entry";

const NAV = [
  { label: "الرئيسية", href: "/" },
  { label: "السلاسل", href: "/series" },
  { label: "محليات", href: "/politics" },
  { label: "اقتصاد", href: "/economy" },
  { label: "رياضة", href: "/sport" },
  { label: "تحليل", href: "/infographics" },
  { label: "مرئي", href: "/videos" },
];

const FOOTER_LINKS = NAV.filter((item) => item.href !== "/");

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
            <span className="hint">ابحث في العلم…</span>
            <kbd>⌘K</kbd>
          </Link>
          <ThemeToggle />
          <MemberEntry />
        </div>
      </div>
      <nav className="mobile-nav" aria-label="التنقل الرئيسي للجوال">
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
      <BreakingBar />
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-shell">
        <div className="footer-top">
          <div className="footer-identity">
            <Link href="/" className="brand-word" aria-label="العلم - الصفحة الرئيسية">
              العلم
            </Link>
            <p>
              منصة إعلام ومعرفة سعودية تضع الخبر في سياقه —
              عبر السلاسل والبيانات والمرئي.
            </p>
          </div>
          <nav className="footer-nav" aria-label="أقسام الموقع">
            {FOOTER_LINKS.map((item) => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
          </nav>
        </div>

        <section className="footer-modules" aria-label="النشرة وسلاسل المعرفة">
          <div className="ft-module">
            <span className="ft-kicker">نشرة أسبوعية</span>
            <h2>ما وراء العناوين في بريدك</h2>
            <p>موجز يختصر أهم ما نشره محررونا — بلا ضوضاء إعلانية.</p>
            <NewsletterForm source="footer" />
          </div>

          <div className="ft-module ft-series-module">
            <span className="ft-kicker">سلاسل المعرفة</span>
            <h2>صحافة تفكك الخبر</h2>
            <p>قوالب تفسيرية تربط الأحداث بسياقها — من التحليل إلى البيانات.</p>
            <div className="ft-series-tags">
              {SERIES.slice(0, 8).map((item) => (
                <Link
                  key={item.slug}
                  href={`/series/${item.slug}`}
                  className="ft-series-chip"
                  style={{ "--sc": item.color } as React.CSSProperties}
                >
                  <span className="ft-series-dot" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
            <Link className="ft-explore-link" href="/series">
              استكشف كل السلاسل والأرشيف <span aria-hidden="true">←</span>
            </Link>
          </div>
        </section>

        <div className="footer-legal">
          <span>© {year} العلم — جميع الحقوق محفوظة</span>
          <span>المحتوى من مواد منشورة · المصدر النهائي «تحرير العلم»</span>
        </div>
      </div>
    </footer>
  );
}
