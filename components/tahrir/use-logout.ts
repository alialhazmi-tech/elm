"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { invalidateViewerSession, viewerSessionStore } from "@/lib/membership/client-session";

/** إنهاء الجلسة ثم العودة إلى شاشة الدخول مع تحديث شجرة الخادم. */
export function useLogout() {
  const router = useRouter();
  return useCallback(async () => {
    const response = await fetch("/api/tahrir/logout", { method: "POST" }).catch(() => null);
    if (response?.ok) {
      viewerSessionStore.removeIdentity("editor");
      invalidateViewerSession();
    }
    router.replace("/tahrir/login");
    router.refresh();
  }, [router]);
}
