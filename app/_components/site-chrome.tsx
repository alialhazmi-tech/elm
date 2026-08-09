import Link from "next/link";

import { ThemeToggle } from "./theme-toggle";
import { storyHref, type Story } from "@/lib/content/types";

const NAV = [
  { label: "الرئيسية", href: "/" },
  { label: "محليات", href: "/politics" },
  { label: "اقتصاد", href: "/economy" },
  { label: "رياضة", href: "/sport" },
  { label: "تحليل", href: "/infographics" },
  { label: "مرئي", href: "/videos" },
];

/**
 * الهيدر: لوح مداد، اللوجوتايب السالب (كلمة «العلم» وحدها —
 * Noto Kufi ‏900)، والنشط بتمييز كحلي فاتح دون أحمر.
 */
export function SiteHeader({ active }: { active?: string }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href="/" aria-label="العلم - الصفحة الرئيسية">
          <span className="brand-word">العلم</span>
          <span className="brand-tag">الخبر كما هو</span>
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
        </div>
      </div>
    </header>
  );
}

/** شريط الأخبار العاجلة — الأحمر إشارة السرعة، نص متحرك من اليمين إلى اليسار. */
export function UrgentBar({ story }: { story: Story }) {
  return (
    <div className="urgent-bar" role="status" aria-label="خبر عاجل">
      <span className="tag">عاجل</span>
      <span className="sep" aria-hidden="true">|</span>
      <div className="urgent-track">
        <Link className="urgent-text" href={storyHref(story)}>
          {story.title} — {story.excerpt.slice(0, 120)}
        </Link>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-word">العلم</span>
          <p>منصة إعلام ومعرفة سعودية — المعرفة وراء الخبر.</p>
        </div>
        <nav className="footer-nav" aria-label="روابط الفوتر">
          {NAV.filter((item) => item.href !== "/").map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
          <Link href="/search">ابحث</Link>
        </nav>
        <span className="left">
          نسخة تطوير — العناوين والصور من مواد alelm.net المنشورة
        </span>
      </div>
    </footer>
  );
}
