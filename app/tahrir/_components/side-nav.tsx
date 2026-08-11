"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function SideNav({ reviewCount, total }: { reviewCount: number; total: number }) {
  const pathname = usePathname();
  const active = (href: string) =>
    (href === "/tahrir" ? pathname === href : pathname.startsWith(href)) ? "on" : "";

  return (
    <nav className="th-nav">
      <div className="sec">العمل اليومي</div>
      <Link href="/tahrir" className={active("/tahrir")}>
        <span className="ic">◧</span> نظرة اليوم
      </Link>
      <Link href="/tahrir/stories" className={active("/tahrir/stories")}>
        <span className="ic">☰</span> المواد <span className="n">{total}</span>
      </Link>
      <Link href="/tahrir/editor/new" className={active("/tahrir/editor")}>
        <span className="ic">✎</span> المحرر
      </Link>
      <Link href="/tahrir/schedule" className={active("/tahrir/schedule")}>
        <span className="ic">◷</span> الجدولة
      </Link>
      <Link href="/tahrir/stories?status=review" className="">
        <span className="ic">✓</span> الاعتماد {reviewCount > 0 && <span className="n">{reviewCount}</span>}
      </Link>
      <div className="sec">المحتوى</div>
      <Link href="/tahrir/series" className={active("/tahrir/series")}>
        <span className="ic">◈</span> السلاسل
      </Link>
      <Link href="/tahrir/media" className={active("/tahrir/media")}>
        <span className="ic">▤</span> الوسائط
      </Link>
      <div className="sec">الذكاء الاصطناعي</div>
      <Link href="/tahrir/ai-images" className={active("/tahrir/ai-images")}>
        <span className="ic">◪</span> توليد الصور
      </Link>
      <Link href="/tahrir/ai-settings" className={active("/tahrir/ai-settings")}>
        <span className="ic">✦</span> إعدادات الذكاء
      </Link>
      <div className="sec">المنصة</div>
      <Link href="/tahrir/stats" className={active("/tahrir/stats")}>
        <span className="ic">∿</span> الإحصاءات
      </Link>
      <Link href="/tahrir/audit" className={active("/tahrir/audit")}>
        <span className="ic">≡</span> سجل التدقيق
      </Link>
    </nav>
  );
}

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      className="out"
      onClick={async () => {
        await fetch("/api/tahrir/logout", { method: "POST" });
        router.replace("/tahrir/login");
        router.refresh();
      }}
    >
      خروج
    </button>
  );
}
