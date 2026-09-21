"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createPageviewTracker } from "@/lib/analytics/pageviews";

const tracker = createPageviewTracker((event, referrer) => {
  const browser = window as typeof window & { dataLayer?: unknown[] };
  const queue = browser.dataLayer ??= [];
  // GTM understands the same Arguments command format as gtag(). Set the
  // previous virtual URL before the legacy event tag consumes Pageview.
  function gtag(...args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params -- Google's dataLayer command protocol requires Arguments, not an Array.
    if (args.length) queue.push(arguments);
  }
  gtag("set", { page_referrer: referrer });
  queue.push(event);
});

export function GooglePageviews() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    // Next commits route metadata with the navigation. Read title and location
    // after the commit, not when a Link is clicked or prefetched.
    const frame = requestAnimationFrame(() => {
      try {
        tracker.track(window.location.href, document.title, document.referrer);
      } catch { /* Analytics blockers must not affect the reader's navigation. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, search]);

  return null;
}
