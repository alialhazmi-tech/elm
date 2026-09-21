"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type NewsStripItem = {
  title: string;
  href: string;
  urgent: boolean;
};

const ROTATION_MS = 6_000;
const REFRESH_MS = 60_000;

export function NewsStrip({ items: initialItems }: { items: NewsStripItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch("/api/content/news-strip", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { items?: NewsStripItem[] };
        if (!active || !Array.isArray(payload.items) || payload.items.length === 0) return;
        setItems(payload.items);
        setIndex((current) => Math.min(current, payload.items!.length - 1));
      } catch {
        // تبقى المواد المرسلة من الخادم ظاهرة إذا تعذر التحديث اللحظي.
      }
    }

    void refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (items.length < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, ROTATION_MS);

    return () => window.clearInterval(timer);
  }, [items.length, paused]);

  const current = items[index] ?? items[0];
  if (!current) return null;

  return (
    <div
      className={current.urgent ? "breaking" : "breaking is-fresh"}
      role="region"
      aria-label="أحدث الأخبار"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="breaking-inner">
        <span className="breaking-dot" aria-hidden="true" />
        <span className="breaking-tag">{current.urgent ? "عاجل" : "الأحدث"}</span>
        <Link key={current.href} className="breaking-title news-strip-enter" href={current.href}>
          {current.title}
        </Link>
      </div>
    </div>
  );
}
