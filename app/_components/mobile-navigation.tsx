"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function MobileNavigation({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    // Links keep their native keyboard behavior; Escape is handled by dialog.
    const dismiss = (event: MouseEvent) => {
      if (event.target === element || (event.target instanceof Element && event.target.closest("a"))) element.close();
    };
    element.addEventListener("click", dismiss);
    return () => element.removeEventListener("click", dismiss);
  }, []);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const body = document.body;
    const previous = [root.style.overflow, body.style.overflow];
    root.style.overflow = body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1101px)");
    const closeOnDesktop = () => { if (desktop.matches) dialog.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      [root.style.overflow, body.style.overflow] = previous;
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  return (
    <div className="site-mobile-navigation">
      <button type="button" className="icon-btn" aria-label="القائمة" aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
        onClick={() => { dialog.current?.showModal(); setOpen(true); }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <dialog ref={dialog} id={id} className="site-drawer" aria-labelledby={`${id}-title`}
        onClose={() => setOpen(false)}>
        <div className="site-drawer-shell">
          <div className="site-drawer-heading">
            <h2 id={`${id}-title`}>تصفح العلم</h2>
            <button type="button" className="icon-btn" aria-label="إغلاق القائمة" onClick={() => dialog.current?.close()}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
            </button>
          </div>
          <nav className="site-drawer-nav" aria-label="التنقل الرئيسي للجوال">{children}</nav>
        </div>
      </dialog>
    </div>
  );
}
