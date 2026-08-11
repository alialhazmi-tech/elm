"use client";

/**
 * حركة «جاك العلم» — العميل الوحيد في القارئ (~1.5KB):
 * كشف دخول الشرائح (صنف .in)، عدادات الأرقام، ونسخ الرابط.
 * الصفحة مقروءة كاملة بدونه — الحركة تحسين لا شرط.
 */

import { useEffect } from "react";

export function JakMotion() {
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const slides = [...document.querySelectorAll<HTMLElement>("[data-jak-slide]")];

    const count = (el: HTMLElement) => {
      if (el.dataset.done) return;
      el.dataset.done = "1";
      const target = Number.parseFloat(el.dataset.count ?? "0");
      const decimals = (el.dataset.count?.split(".")[1] ?? "").length;
      if (reduced) {
        el.textContent = el.dataset.count ?? "";
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 1400);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = (target * eased).toFixed(decimals);
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          entry.target.querySelectorAll<HTMLElement>("[data-count]").forEach(count);
        }
      },
      { threshold: 0.4 },
    );
    slides.forEach((slide) => observer.observe(slide));

    const onCopy = (event: Event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-jak-copy]");
      if (!target) return;
      navigator.clipboard?.writeText(target.dataset.jakCopy ?? "").then(() => {
        target.textContent = "نُسخ ✓";
      });
    };
    document.addEventListener("click", onCopy);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onCopy);
    };
  }, []);

  return null;
}
