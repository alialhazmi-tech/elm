"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { nextRefreshDelay } from "@/lib/tahrir/schedule-refresh";

/**
 * تحديث عرض الجدول فقط؛ النشر مستقل على الخادم.
 * الوتيرة من الخادم: أقرب موعد جدولة يحدد هل نترقّب (15 ثانية) أم نهدأ (دقيقة)، ولا تحديث والصفحة مخفية.
 */
export function ScheduleRefresh({ active, nextScheduledAt }: { active: boolean; nextScheduledAt: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let timer = 0;
    const schedule = () => { timer = window.setTimeout(tick, nextRefreshDelay(nextScheduledAt)); };
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
      schedule();
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      tick();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [active, nextScheduledAt, router]);
  return null;
}
