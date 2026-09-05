"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Expanded without JavaScript; collapsible on phones, always visible on desktop. */
export function FooterNavigation({ children }: { children: ReactNode }) {
  const navigation = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = navigation.current;
    if (!element) return;
    const mobile = window.matchMedia("(max-width: 640px)");
    const sync = () => {
      element.querySelectorAll("details").forEach((group) => {
        group.open = !mobile.matches;
        const summary = group.querySelector("summary");
        if (summary) summary.tabIndex = mobile.matches ? 0 : -1;
      });
    };
    const keepDesktopOpen = (event: MouseEvent) => {
      if (!mobile.matches && event.target instanceof Element && event.target.closest("summary")) event.preventDefault();
    };
    sync();
    mobile.addEventListener("change", sync);
    element.addEventListener("click", keepDesktopOpen);
    return () => {
      mobile.removeEventListener("change", sync);
      element.removeEventListener("click", keepDesktopOpen);
    };
  }, []);

  return <nav className="footer-navigation" aria-label="روابط الموقع" ref={navigation}>{children}</nav>;
}
