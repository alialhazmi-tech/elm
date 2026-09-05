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
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const latest = useRef({ key, encoded, pendingRecovery: false });
  useEffect(() => { latest.current = { key, encoded, pendingRecovery: Boolean(recovery) }; }, [key, encoded, recovery]);
  useEffect(() => () => {
    // التنقل داخل اللوحة لا يطلق beforeunload؛ احفظ آخر كتابة قبل فك المحرر.
    const value = latest.current;
    if (!value.pendingRecovery && value.encoded !== saved.current) {
      try { localStorage.setItem(value.key, JSON.stringify({ at: Date.now(), value: value.encoded })); } catch { /* المتصفح قد يمنع التخزين */ }
    }
  }, []);
  useEffect(() => {
    // نقرأ التخزين بعد أول رسم كي يتطابق الرندر الأول مع HTML الخادم.
    const frame = requestAnimationFrame(() => {
    try {
      const raw = localStorage.getItem(key);
      setRecovery(null);
      if (raw) {
        const record = JSON.parse(raw);
        if (Date.now() - record.at < 7 * 86400_000 && record.value !== saved.current) setRecovery(JSON.parse(record.value) as T);
        else localStorage.removeItem(key);
      }
    } catch { setUnavailable(true); }
    setLoadedKey(key);
    });
    return () => cancelAnimationFrame(frame);
  }, [key]);
  useEffect(() => {
    if (loadedKey !== key || encoded === saved.current || recovery) return;
    const persist = () => {
      try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), value: encoded })); }
      catch { setUnavailable(true); }
    };
    const timer = window.setTimeout(persist, 800);
    const warn = (event: BeforeUnloadEvent) => { persist(); event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", persist);
    return () => { window.clearTimeout(timer); window.removeEventListener("beforeunload", warn); window.removeEventListener("pagehide", persist); };
  }, [encoded, key, recovery, savedGeneration, loadedKey]);
  return {
    recovery, unavailable, ready: loadedKey === key,
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
