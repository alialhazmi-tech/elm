"use client";

/**
 * «معرض الإنفوجرافيك»: شريط صور طويلة بنقاط تنقّل — المكوّن العميل الوحيد في تدفّق الرئيسية.
 * («الجديد الآن» النهر الحي أُزيل مع إعادة تصميم الرئيسية 2026-09-01.)
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
