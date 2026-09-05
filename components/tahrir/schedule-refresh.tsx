"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** تحديث عرض الجدول فقط؛ النشر مستقل على الخادم. */
export function ScheduleRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [active, router]);
  return null;
}
