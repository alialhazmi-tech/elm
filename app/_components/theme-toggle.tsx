"use client";

/**
 * تبديل الوضع الفاتح/الداكن بلا حالة React:
 * القراءة من DOM عند النقر، والأيقونة تُبدَّل عبر CSS حسب data-theme —
 * فلا انزياح ترطيب ولا setState داخل تأثير.
 */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const current =
      root.dataset.theme ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("alelm-theme", next);
    } catch {
      /* التخزين قد يكون معطلًا — يبقى التبديل للجلسة */
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label="تبديل الوضع الفاتح والداكن"
    >
      <span className="tt-light" aria-hidden="true">◐</span>
      <span className="tt-dark" aria-hidden="true">☀</span>
    </button>
  );
}
