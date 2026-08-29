"use client";

/** يضغط الهيدر بعد 80px من التمرير — سمة على الجذر يقرأها CSS، بلا حالة React. */

import { useEffect } from "react";

export function HeaderScroll() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      raf = 0;
      const compact = window.scrollY > 80;
      if (compact) root.dataset.compact = "";
      else delete root.dataset.compact;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      delete root.dataset.compact;
    };
  }, []);
  return null;
}
