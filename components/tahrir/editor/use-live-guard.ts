"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GuardReport } from "@/lib/policy/types";

/** المدخلات نفسها التي يفحصها الخادم عند الاعتماد — أي حقل يغيب هنا يغيب عن قواعده. */
export interface LiveGuardInput {
  title: string;
  /** نص المتن الخالص أو HTML — الخادم يحوّله نصًا. */
  body: string;
  image: string;
  format: string;
  breakingUntil: string | null;
}

export const GUARD_DEBOUNCE_MS = 600;

/**
 * الحارس الحي: فحص مؤجل بعد توقف الكتابة، طلب واحد حي في كل لحظة (السابق يُلغى)،
 * وحالة خطأ صريحة تُبقي بوابة الاعتماد مغلقة حتى فحص ناجح.
 */
export function useLiveGuard(current: LiveGuardInput) {
  const [report, setReport] = useState<GuardReport | null>(null);
  const [guardBusy, setGuardBusy] = useState(true);
  const [guardError, setGuardError] = useState(false);
  const latest = useRef(current);
  const sequence = useRef(0);
  const timer = useRef<number | null>(null);
  const inflight = useRef<AbortController | null>(null);
  useEffect(() => { latest.current = current; });

  const runGuard = useCallback(async (input: LiveGuardInput) => {
    const ticket = ++sequence.current;
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setGuardBusy(true);
    const response = await fetch("/api/tahrir/guard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ title: input.title, body: input.body, image: input.image || null, format: input.format, breakingUntil: input.breakingUntil }),
    }).catch(() => null);
    if (ticket !== sequence.current) return;
    const data = response?.ok ? ((await response.json().catch(() => null)) as GuardReport | null) : null;
    if (ticket !== sequence.current) return;
    if (data && Array.isArray(data.findings) && data.counts) {
      setReport(data);
      setGuardError(false);
    } else {
      setReport(null);
      setGuardError(true);
    }
    setGuardBusy(false);
  }, []);

  /** يجدول فحصًا بالقيم الحالية مع ما تغيّر منها؛ يلغي الفحص المؤجل السابق. */
  const scheduleGuard = useCallback((patch: Partial<LiveGuardInput> = {}) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setGuardBusy(true);
    const input = { ...latest.current, ...patch };
    timer.current = window.setTimeout(() => void runGuard(input), GUARD_DEBOUNCE_MS);
  }, [runGuard]);

  /** فحص فوري بالقيم الحالية — بعد رفض الخادم أو عند «أعد الفحص». */
  const retryGuard = useCallback((patch: Partial<LiveGuardInput> = {}) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    return runGuard({ ...latest.current, ...patch });
  }, [runGuard]);

  useEffect(() => {
    // الفحص الأول يعكس القيم المحمّلة لحظة فتح المحرر؛ التعديلات اللاحقة تمر عبر scheduleGuard.
    timer.current = window.setTimeout(() => void runGuard(latest.current), 0);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      sequence.current += 1;
      inflight.current?.abort();
    };
  }, [runGuard]);

  const gateOpen = !guardBusy && !guardError && report?.canRequestApproval === true;
  return { report, guardBusy, guardError, gateOpen, scheduleGuard, retryGuard };
}
