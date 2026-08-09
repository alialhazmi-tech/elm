import Link from "next/link";

import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { label: "وراء الخبر", href: "/politics" },
  { label: "السلاسل", href: "/series/absat" },
  { label: "بالأرقام", href: "/infographics" },
  { label: "مرئي", href: "/videos" },
  { label: "اقتصاد", href: "/economy" },
  { label: "رياضة", href: "/sport" },
];

/** شعار «المنشور»: الخبر يدخل ضوءًا ويخرج طيفًا من السلاسل. */
export function PrismMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 36) / 40} viewBox="0 0 44 40" aria-hidden="true">
      <path d="M22 3 L41 37 H3 Z" fill="#12284b" />
      <path d="M22 3 L41 37 H3 Z" fill="none" stroke="#f5b92e" strokeWidth="1.6" />
      <line x1="44" y1="20" x2="30" y2="20" stroke="#f5b92e" strokeWidth="2.4" />
      <line x1="14" y1="14" x2="0" y2="9" stroke="#ef476f" strokeWidth="2.2" />
      <line x1="13" y1="20" x2="0" y2="20" stroke="#3d7ef7" strokeWidth="2.2" />
      <line x1="14" y1="26" x2="0" y2="31" stroke="#12b5a0" strokeWidth="2.2" />
    </svg>
  );
}

export function SiteHeader({ active }: { active?: string }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href="/" aria-label="العلم - الصفحة الرئيسية">
          <PrismMark />
          <span>
            <span className="brand-word">العلم</span>
            <span className="brand-tag">المعرفة وراء الخبر</span>
          </span>
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
          <Link className="ask-pill" href="/search" aria-label="اسأل العلم — البحث">
            <span className="spark">✦</span>
            <span className="hint">اسأل العلم عن أي شيء…</span>
            <kbd>⌘K</kbd>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="brand-word">العلم</span>
        <p>منصة إعلام ومعرفة سعودية — السياق قبل السرعة.</p>
        <span className="left">
          نسخة تطوير — العناوين والصور من مواد alelm.net المنشورة، والمصدر النهائي «تحرير العلم»
        </span>
      </div>
    </footer>
  );
}
