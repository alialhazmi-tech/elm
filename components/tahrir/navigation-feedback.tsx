"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LoaderCircleIcon } from "lucide-react";
import { createNavigationTracker } from "@/lib/performance/navigation";
import { dashboardPerformanceRoute } from "@/lib/performance/protocol";

/** Observe actual links and committed page content; no polling or blocking data fetch. */
export function NavigationFeedback() {
  const pathname = usePathname(); const search = useSearchParams().toString();
  const fromKey = useRef<string | null>(null);
  const tracker = useRef<ReturnType<typeof createNavigationTracker> | null>(null);
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayed = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    tracker.current = createNavigationTracker({ now: () => performance.now(), wallTime: Date.now, id: () => crypto.randomUUID(), routeFor: dashboardPerformanceRoute,
      network: (key, since) => {
        const matches = performance.getEntriesByType("resource").filter(entry => {
          if (entry.startTime < since) return false;
          const url = new URL(entry.name); url.searchParams.delete("_rsc");
          return url.origin === location.origin && url.pathname + url.search === key;
        }) as PerformanceResourceTiming[];
        const entry = matches.sort((a, b) => b.duration - a.duration)[0];
        return entry ? { networkMs: Math.round(entry.duration), ttfbMs: Math.round(Math.max(0, entry.responseStart - entry.requestStart)) } : {};
      },
      report: event => {
        if (event.value >= 1500 || Math.random() < 0.1) void fetch("/api/tahrir/performance", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify([{ ...event, sample: event.value >= 1500 ? "slow" : "random" }]) }).catch(() => {});
      },
    });
    function start(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href); if (url.hash || url.origin !== location.origin || !dashboardPerformanceRoute(url.pathname)) return;
      if (tracker.current?.start(anchor.href, location.href, location.origin)) {
        if (timeout.current) clearTimeout(timeout.current); if (delayed.current) clearTimeout(delayed.current);
        fromKey.current = location.pathname + location.search;
        setSlow(false); delayed.current = setTimeout(() => setPending(true), 250);
        timeout.current = setTimeout(() => { setSlow(true); tracker.current?.finish("timeout"); }, 15_000);
      }
    }
    function hidden() {
      if (document.visibilityState !== "hidden") return;
      tracker.current?.finish("hidden"); fromKey.current = null;
      if (timeout.current) clearTimeout(timeout.current); if (delayed.current) clearTimeout(delayed.current);
      setPending(false); setSlow(false);
    }
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("click", start, true);
    return () => { document.removeEventListener("visibilitychange", hidden); document.removeEventListener("click", start, true); if (timeout.current) clearTimeout(timeout.current); if (delayed.current) clearTimeout(delayed.current); tracker.current?.finish("hidden"); tracker.current = null; };
  }, []);
  useEffect(() => {
    let frame = 0;
    function commit() {
      const loading = document.querySelector('[data-tahrir-content] [aria-busy="true"]');
      if (loading) return;
      const completed = tracker.current?.commit(pathname, search);
      if (completed || (fromKey.current !== null && fromKey.current !== pathname + (search ? "?" + search : ""))) {
        fromKey.current = null;
        if (timeout.current) clearTimeout(timeout.current); if (delayed.current) clearTimeout(delayed.current);
        setPending(false); setSlow(false);
      }
    }
    const container = document.querySelector("[data-tahrir-content]");
    const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(commit); });
    if (container) observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-busy"] });
    frame = requestAnimationFrame(commit);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [pathname, search]);
  if (!pending) return null;
  return <div role="status" className="fixed bottom-4 start-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl border bg-background px-4 py-3 text-sm shadow-lg rtl:translate-x-1/2"><LoaderCircleIcon className="size-4 shrink-0 animate-spin" /><span>{slow ? "التنقل يستغرق وقتًا أطول. تحقق من الاتصال؛ احتفظ بأي كتابة قبل تحديث المتصفح." : "جارٍ فتح الصفحة…"}</span></div>;
}
