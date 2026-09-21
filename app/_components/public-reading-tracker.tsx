"use client";

import { useEffect } from "react";
import { loadArticleInteraction } from "./interaction-client";

/** قياس واحد لجميع الزوار؛ الزمن تراكمي داخل جلسة المادة، ولا يُحسب في الخلفية. */
export function PublicReadingTracker({ storyId }: { storyId: string }) {
  useEffect(() => {
    if (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const sessionId = crypto.randomUUID();
    let activeMs = 0;
    let progress = 0;
    let previous = Date.now();
    let lastSent = 0;
    let busy = false;
    let stopped = false;
    let enabled = true;
    let ready = false;
    let visible = document.visibilityState === "visible" && document.hasFocus();
    const sample = () => {
      const now = Date.now();
      const body = document.querySelector(".article-body");
      if (body && visible) {
        const rect = body.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          activeMs += Math.min(now - previous, 2500);
          const distance = Math.max(1, rect.height - window.innerHeight);
          const reached = rect.height <= window.innerHeight
            ? (rect.bottom <= window.innerHeight ? 100 : 0)
            : Math.min(100, Math.max(0, (-rect.top / distance) * 100));
          progress = Math.max(progress, Math.round(reached));
        }
      }
      previous = now;
    };
    const send = (final = false) => {
      if (!ready || !enabled || (busy && !final)) return;
      busy = true;
      lastSent = Date.now();
      void fetch("/api/content/reading", {
        method: "POST", credentials: "same-origin", keepalive: final,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, sessionId, activeMs, progress }),
      }).then(async response => {
        if (response.ok && (await response.json()).accepted === false) enabled = false;
      }).catch(() => undefined).finally(() => { busy = false; });
    };
    void loadArticleInteraction(storyId).catch(() => undefined).then(() => {
      if (!stopped) { ready = true; send(); }
    });
    const timer = window.setInterval(() => {
      sample();
      if (visible && Date.now() - lastSent >= 15_000) send();
    }, 2000);
    const onVisibility = () => {
      sample();
      visible = document.visibilityState === "visible" && document.hasFocus();
      if (!visible) send(true);
    };
    const onFocus = () => { previous = Date.now(); visible = document.visibilityState === "visible"; };
    const onBlur = () => { sample(); visible = false; send(true); };
    const onPageHide = () => { sample(); send(true); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      if (stopped) return;
      stopped = true;
      sample(); send(true);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [storyId]);
  return null;
}
