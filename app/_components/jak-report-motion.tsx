"use client";

/**
 * أرقام التقرير تصعد إلى قيمتها عند ظهور صفحتها للقارئ.
 *
 * القيمة النهائية مطبوعة في HTML من الخادم (تصل للزاحف ولمن عطّل جافاسكربت)،
 * وهذا المكوّن يعيدها إلى نقطة البداية لحظة الدخول ثم يصعد بها — فلا يفقد
 * أحد الرقم إن لم تعمل الحركة.
 */

import { useEffect } from "react";

/** السنة تصعد من نافذة قصيرة قبلها؛ الكميات تصعد من الصفر. */
const startOf = (target: number, decimals: number) => {
  const isYear = decimals === 0 && Number.isInteger(target) && target >= 1900 && target <= 2100;
  return isYear ? target - 12 : 0;
};

export function JakReportMotion() {
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pages = [...document.querySelectorAll<HTMLElement>("[data-report-page]")];
    if (pages.length === 0) return;

    const runCountUp = (element: HTMLElement) => {
      if (element.dataset.done) return;
      element.dataset.done = "1";
      const raw = element.dataset.countup ?? "";
      const target = Number.parseFloat(raw);
      if (!Number.isFinite(target)) return;
      const decimals = (raw.split(".")[1] ?? "").length;
      if (reduced) return;

      const from = startOf(target, decimals);
      const started = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - started) / 1500);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = (from + (target - from) * eased).toFixed(decimals);
        if (progress < 1) requestAnimationFrame(tick);
        else element.textContent = raw;
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          entry.target.querySelectorAll<HTMLElement>("[data-countup]").forEach(runCountUp);
        }
      },
      { threshold: 0.35 },
    );
    pages.forEach((page) => observer.observe(page));
    return () => observer.disconnect();
  }, []);

  return null;
}
