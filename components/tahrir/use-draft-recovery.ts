"use client";

import { useEffect, useRef, useState } from "react";

/** مدة بقاء النسخة المحلية قبل إسقاطها. */
const RECOVERY_TTL_MS = 7 * 86400_000;
const TAB_TOKEN_KEY = "tahrir:draft-tab";

/** ما نعرفه عن نسخة الخادم لحظة الكتابة المحلية — للمقارنة عند الاستعادة. */
export interface RecoveryServerState {
  version: number;
  updatedAt?: string | null;
}

export interface RecoveryMeta {
  /** كُتبت النسخة المحلية على نسخة خادم أقدم من التي فُتحت الآن. */
  stale: boolean;
  storedVersion: number | null;
  storedUpdatedAt: string | null;
  currentVersion: number;
  at: number;
}

interface StoredRecord {
  at: number;
  value: string;
  version?: number;
  updatedAt?: string | null;
}

/**
 * رمز ثابت لكل تبويب متصفح — مفتاح المسودة الجديدة يستخدمه بدل «new» المشترك
 * حتى لا يكتب تبويبان جديدان فوق بعضهما. يعيش في sessionStorage فيصمد لإعادة التحميل.
 */
export function useDraftTabToken(): string {
  const [token] = useState(() => {
    if (typeof sessionStorage === "undefined") return "new";
    try {
      const existing = sessionStorage.getItem(TAB_TOKEN_KEY);
      if (existing?.startsWith("tahrir:draft-tab:")) return existing;
      const created = `tahrir:draft-tab:${crypto.randomUUID()}`;
      sessionStorage.setItem(TAB_TOKEN_KEY, created);
      return created;
    } catch {
      return "new";
    }
  });
  return token;
}

/** نسخة محلية مؤقتة لكل محرر؛ لا تطبق ولا تنشر شيئًا تلقائيًا. */
export function useDraftRecovery<T>(key: string, snapshot: T, server: RecoveryServerState = { version: 0 }) {
  const encoded = JSON.stringify(snapshot);
  // نعتمد على القيمتين الأوليتين لا على هوية الكائن حتى لا تُعاد جدولة الحفظ مع كل رندر.
  const serverVersion = server.version;
  const serverUpdatedAt = server.updatedAt ?? null;
  const saved = useRef(encoded);
  const currentKey = useRef(key);
  useEffect(() => { currentKey.current = key; }, [key]);
  const [savedGeneration, setSavedGeneration] = useState(0);
  const [recovery, setRecovery] = useState<T | null>(null);
  const [recoveryMeta, setRecoveryMeta] = useState<RecoveryMeta | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const latest = useRef({ key, encoded, pendingRecovery: false, server: { version: serverVersion, updatedAt: serverUpdatedAt } });
  useEffect(() => {
    latest.current = { key, encoded, pendingRecovery: Boolean(recovery), server: { version: serverVersion, updatedAt: serverUpdatedAt } };
  }, [key, encoded, recovery, serverVersion, serverUpdatedAt]);
  const write = (target: string, value: string, state: RecoveryServerState) => {
    const record: StoredRecord = { at: Date.now(), value, version: state.version, updatedAt: state.updatedAt ?? null };
    localStorage.setItem(target, JSON.stringify(record));
  };
  useEffect(() => () => {
    // التنقل داخل اللوحة لا يطلق beforeunload؛ احفظ آخر كتابة قبل فك المحرر.
    const value = latest.current;
    if (!value.pendingRecovery && value.encoded !== saved.current) {
      try { write(value.key, value.encoded, value.server); } catch { /* المتصفح قد يمنع التخزين */ }
    }
  }, []);
  useEffect(() => {
    // نقرأ التخزين بعد أول رسم كي يتطابق الرندر الأول مع HTML الخادم.
    const frame = requestAnimationFrame(() => {
    try {
      const raw = localStorage.getItem(key);
      setRecovery(null);
      setRecoveryMeta(null);
      if (raw) {
        const record = JSON.parse(raw) as StoredRecord;
        if (Date.now() - record.at < RECOVERY_TTL_MS && record.value !== saved.current) {
          const currentVersion = latest.current.server.version;
          const storedVersion = typeof record.version === "number" ? record.version : null;
          setRecovery(JSON.parse(record.value) as T);
          setRecoveryMeta({
            stale: storedVersion !== null && storedVersion !== currentVersion,
            storedVersion,
            storedUpdatedAt: record.updatedAt ?? null,
            currentVersion,
            at: record.at,
          });
        } else localStorage.removeItem(key);
      }
    } catch { setUnavailable(true); }
    setLoadedKey(key);
    });
    return () => cancelAnimationFrame(frame);
  }, [key]);
  useEffect(() => {
    if (loadedKey !== key || encoded === saved.current || recovery) return;
    const persist = () => {
      try { write(key, encoded, { version: serverVersion, updatedAt: serverUpdatedAt }); }
      catch { setUnavailable(true); }
    };
    const timer = window.setTimeout(persist, 800);
    const warn = (event: BeforeUnloadEvent) => { persist(); event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", persist);
    return () => { window.clearTimeout(timer); window.removeEventListener("beforeunload", warn); window.removeEventListener("pagehide", persist); };
  }, [encoded, key, recovery, savedGeneration, loadedKey, serverVersion, serverUpdatedAt]);
  const forget = () => {
    try { localStorage.removeItem(key); localStorage.removeItem(currentKey.current); } catch { /* لا نعطل الحفظ الخادمي */ }
  };
  return {
    recovery, recoveryMeta, unavailable, ready: loadedKey === key,
    dismiss() {
      try { localStorage.removeItem(key); } catch { setUnavailable(true); }
      setRecovery(null);
      setRecoveryMeta(null);
    },
    markSaved(value: T) {
      saved.current = JSON.stringify(value);
      setSavedGeneration(n => n + 1);
      forget();
    },
    /** بعد النشر أو الأرشفة: لا نسخة محلية تُعرض لاحقًا ولا تُكتب عند فك المحرر. */
    clear() {
      saved.current = encoded;
      latest.current = { ...latest.current, encoded, pendingRecovery: false };
      setSavedGeneration(n => n + 1);
      setRecovery(null);
      setRecoveryMeta(null);
      forget();
    },
  };
}
