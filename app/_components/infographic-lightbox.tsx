"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from "react";

export function InfographicLightbox({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (failed) return null;

  return (
    <>
      <button
        type="button"
        className="article-figure--infographic group"
        onClick={() => setIsOpen(true)}
        aria-label={`عرض ${title} بدقة كاملة`}
      >
        <img
          src={src}
          alt={title}
          className="infographic-main-img"
          loading="eager"
          onError={() => setFailed(true)}
        />
        <div className="infographic-overlay-hint" aria-hidden="true">
          <span className="infographic-zoom-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            انقر لتكبير الإنفوجرافيك بالدقة الكاملة
          </span>
        </div>
      </button>

      {/* نافذة التكبير الكامل (Full Lightbox Modal) */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="infographic-lightbox-modal"
        >
          <button
            type="button"
            className="infographic-lightbox-backdrop"
            onClick={() => setIsOpen(false)}
            aria-label="إغلاق نافذة التكبير"
          />

          <div className="infographic-lightbox-header">
            <span className="infographic-lightbox-title">{title}</span>
            <div className="infographic-lightbox-actions">
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="infographic-lightbox-btn"
                download
              >
                فتح الصورة الأصلية ↗
              </a>
              <button
                type="button"
                className="infographic-lightbox-close"
                onClick={() => setIsOpen(false)}
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="infographic-lightbox-body">
            <img
              src={src}
              alt={title}
              className="infographic-lightbox-img"
            />
          </div>
        </div>
      )}
    </>
  );
}
