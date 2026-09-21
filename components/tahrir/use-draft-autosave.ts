"use client";

import { useEffect, useEffectEvent, useState } from "react";

/** حفظ المسودات بعد توقف الكتابة؛ الخطأ يوقف المحاولات حتى حفظ يدوي ناجح. */
export function useDraftAutosave<T>({ snapshot, enabled, onSave }: {
  snapshot: T; enabled: boolean; onSave: () => Promise<string | null>;
}) {
  const encoded = JSON.stringify(snapshot);
  const [confirmed, setConfirmed] = useState(encoded);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveLatest = useEffectEvent(async () => {
    setState("saving");
    try {
      if (!await onSave()) setState("error");
    } catch { setState("error"); }
  });
  useEffect(() => {
    if (!enabled || encoded === confirmed || state === "saving" || state === "error") return;
    const timer = window.setTimeout(() => void saveLatest(), 2000);
    return () => window.clearTimeout(timer);
  }, [encoded, confirmed, enabled, state]);

  return {
    dirty: encoded !== confirmed, state, savedAt,
    markSaved(value: T) { setConfirmed(JSON.stringify(value)); setState("saved"); setSavedAt(new Date()); },
    markFailed() { setState("error"); },
  };
}
