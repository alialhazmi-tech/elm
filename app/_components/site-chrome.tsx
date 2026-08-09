import Link from "next/link";

const NAV = [
  { label: "السلاسل", href: "/series/absat" },
  { label: "وراء الخبر", href: "/politics" },
  { label: "بالأرقام", href: "/infographics" },
  { label: "رياضة", href: "/sport" },
  { label: "اقتصاد", href: "/economy" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/" aria-label="العلم - الصفحة الرئيسية">
          <span className="brand-mark" aria-hidden="true">ع</span>
          <span className="brand-word">العلم</span>
        </Link>
        <nav aria-label="التنقل الرئيسي">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <form className="header-search" action="/search" role="search">
          <input
            type="search"
            name="q"
            placeholder="ابحث في العلم"
            aria-label="ابحث في العلم"
            dir="rtl"
          />
        </form>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="footer-brand">العلم</div>
      <p>منصة إعلام ومعرفة سعودية تضع السياق قبل السرعة.</p>
      <p className="footer-note">
        نسخة تطوير — العناوين والصور من مواد alelm.net المنشورة، والمصدر النهائي «تحرير العلم».
      </p>
    </footer>
  );
}
