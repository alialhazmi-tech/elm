"use client";

/**
 * «الجديد الآن»: نهر أفقي قابل للسحب يتجدد كل دقيقتين بلا إعادة تحميل،
 * و«معرض الإنفوجرافيك»: شريط صور طويلة بنقاط تنقّل.
 */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface RiverItem {
  id: string;
  href: string;
  title: string;
  image: string | null;
  kick: string;
  color: string | null;
  when: string;
  publishedAt: string | null;
  /** نُشرت خلال الساعة الأخيرة — تُحسب عند التوليد لا في العرض. */
  fresh: boolean;
}

const REFRESH_MS = 120_000;

export function NewsRiver({ initial, exclude }: { initial: RiverItem[]; exclude: string[] }) {
  const [items, setItems] = useState(initial);
  const [newCount, setNewCount] = useState(0);
  const pending = useRef<RiverItem[] | null>(null);

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/content/stream?exclude=${encodeURIComponent(exclude.join(","))}`);
        if (!response.ok) return;
        const data = (await response.json()) as { items?: RiverItem[] };
        const next = Array.isArray(data.items) ? data.items : [];
        const known = new Set(items.map((item) => item.id));
        const fresh = next.filter((item) => !known.has(item.id)).length;
        if (fresh > 0) {
          pending.current = next;
          setNewCount(fresh);
        }
      } catch {
        /* الشبكة — نحاول في الدورة التالية */
      }
    };
    const timer = window.setInterval(tick, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [exclude, items]);

  const apply = useCallback(() => {
    if (pending.current) setItems(pending.current);
    pending.current = null;
    setNewCount(0);
  }, []);

  return (
    <div className="river-wrap">
      {newCount > 0 ? (
        <button type="button" className="river-new" onClick={apply}>
          {newCount === 1 ? "مادة جديدة" : `${newCount} مواد جديدة`} — اعرضها
        </button>
      ) : null}
      <div className="river" role="list">
        {items.map((item) => {
          const fresh = item.fresh;
          return (
            <article key={item.id} className="river-card" role="listitem" data-story-id={item.id}>
              {item.image ? (
                <Link className="river-img" href={item.href} tabIndex={-1} aria-hidden="true">
                  <Image src={item.image} alt="" fill sizes="96px" />
                </Link>
              ) : null}
              <div className="river-body">
                <span className="kick" style={{ "--kc": item.color ?? undefined } as React.CSSProperties}>
                  {item.kick}
                  {item.when ? <span className="sect">· {item.when}</span> : null}
                  {fresh ? <i className="live-dot" aria-label="نُشرت خلال الساعة" /> : null}
                </span>
                <h3><Link className="story-link" href={item.href}>{item.title}</Link></h3>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export interface GalleryItem { id: string; href: string; title: string; image: string; kick: string }

export function InfographicGallery({ items }: { items: GalleryItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / 3));

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const width = track.clientWidth || 1;
        setIndex(Math.min(pages - 1, Math.round(Math.abs(track.scrollLeft) / width)));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => { track.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [pages]);

  const goTo = (page: number) => {
    const track = trackRef.current;
    if (!track) return;
    const target = ((page % pages) + pages) % pages;
    const dir = getComputedStyle(track).direction === "rtl" ? -1 : 1;
    track.scrollTo({ left: dir * target * track.clientWidth, behavior: "smooth" });
    setIndex(target);
  };

  return (
    <div className="gallery-wrap">
      <div className="gallery" ref={trackRef}>
        {items.map((item) => (
          <article key={item.id} className="gallery-card" data-story-id={item.id}>
            <Link className="gallery-img" href={item.href} aria-label={item.title}>
              <Image src={item.image} alt="" fill sizes="(max-width: 640px) 80vw, 380px" />
            </Link>
            <span className="kick">{item.kick}</span>
            <h3><Link className="story-link" href={item.href}>{item.title}</Link></h3>
          </article>
        ))}
      </div>
      {pages > 1 ? (
        <nav className="gallery-nav" aria-label="التنقل في المعرض">
          <span className="ins-dots">
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} type="button" className={i === index ? "is-on" : undefined} aria-label={`الصفحة ${i + 1}`} onClick={() => goTo(i)} />
            ))}
          </span>
          <span className="ins-arrows">
            <button type="button" aria-label="السابق" onClick={() => goTo(index - 1)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg></button>
            <button type="button" aria-label="التالي" onClick={() => goTo(index + 1)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg></button>
          </span>
        </nav>
      ) : null}
    </div>
  );
}
