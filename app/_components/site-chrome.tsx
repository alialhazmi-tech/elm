import Link from "next/link";

import { getBreaking } from "@/lib/content/provider";
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
      <BreakingBar />
    </header>
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
