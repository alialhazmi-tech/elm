"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/** إنهاء الجلسة ثم العودة إلى شاشة الدخول مع تحديث شجرة الخادم. */
export function useLogout() {
  const router = useRouter();
  return useCallback(async () => {
    await fetch("/api/tahrir/logout", { method: "POST" }).catch(() => null);
    router.replace("/tahrir/login");
    router.refresh();
  }, [router]);
}
