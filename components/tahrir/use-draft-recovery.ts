"use client";

import { useEffect, useRef, useState } from "react";

/** نسخة محلية مؤقتة لكل محرر؛ لا تطبق ولا تنشر شيئًا تلقائيًا. */
export function useDraftRecovery<T>(key: string, snapshot: T) {
  const encoded = JSON.stringify(snapshot);
  const saved = useRef(encoded);
  const currentKey = useRef(key);
  useEffect(() => { currentKey.current = key; }, [key]);
  const [savedGeneration, setSavedGeneration] = useState(0);
  const [recovery, setRecovery] = useState<T | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    // نقرأ التخزين بعد أول رسم كي يتطابق الرندر الأول مع HTML الخادم.
    const frame = requestAnimationFrame(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const record = JSON.parse(raw);
        if (Date.now() - record.at < 7 * 86400_000 && record.value !== saved.current) setRecovery(JSON.parse(record.value) as T);
      }
    } catch { setUnavailable(true); }
    });
    return () => cancelAnimationFrame(frame);
  }, [key]);
  useEffect(() => {
    if (encoded === saved.current || recovery) return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), value: encoded })); }
      catch { setUnavailable(true); }
    }, 800);
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => { window.clearTimeout(timer); window.removeEventListener("beforeunload", warn); };
  }, [encoded, key, recovery, savedGeneration]);
  return {
    recovery, unavailable,
    dismiss() {
      try { localStorage.removeItem(key); } catch { setUnavailable(true); }
      setRecovery(null);
    },
    markSaved(value: T) {
      saved.current = JSON.stringify(value);
      setSavedGeneration(n => n + 1);
      try { localStorage.removeItem(key); localStorage.removeItem(currentKey.current); } catch { /* لا نعطل الحفظ الخادمي */ }
    },
  };
}
