"use client";

import { useEffect, useRef, useState } from "react";

import type { FullEditProgressStage } from "@/lib/ai/editorial";

import type { FullEditData, FullEditProgress } from "./full-edit";

export const INITIAL_FULL_PROGRESS: FullEditProgress = {
  request: "waiting",
  body: "waiting",
  pack: "waiting",
  guard: "waiting",
};

export function advanceFullProgress(
  current: FullEditProgress,
  stage: FullEditProgressStage,
): FullEditProgress {
  if (stage === "accepted") return { ...current, request: "done" };
  if (stage === "body_started") return { ...current, request: "done", body: "active" };
  if (stage === "pack_started") return { ...current, request: "done", pack: "active" };
  if (stage === "body_ready") return { ...current, body: "done" };
  if (stage === "pack_ready") return { ...current, pack: "done" };
  if (stage === "guard_checking") {
    return { request: "done", body: "done", pack: "done", guard: "active" };
  }
  return { request: "done", body: "done", pack: "done", guard: "done" };
}

export type EditorMessage = { kind: "ok" | "err"; text: string } | null;

/**
 * التحرير الشامل المبثوث (NDJSON): تقدم المراحل، عدّاد الوقت، الإيقاف، وحماية المسودة —
 * أي تعديل بعد بدء التوليد يجعل المقترح «قديمًا» فلا يُطبَّق فوق كتابة أحدث.
 */
export function useFullEditStream({ setMessage }: { setMessage: (message: EditorMessage) => void }) {
  const [fullEdit, setFullEdit] = useState<FullEditData | null>(null);
  const [fullBusy, setFullBusy] = useState(false);
  const [fullElapsed, setFullElapsed] = useState(0);
  const [fullProgress, setFullProgress] = useState<FullEditProgress>(INITIAL_FULL_PROGRESS);
  const [fullEditStale, setFullEditStale] = useState(false);
  const fullAbort = useRef<AbortController | null>(null);
  const draftRevision = useRef(0);
  const fullStartRevision = useRef(0);

  useEffect(() => {
    if (!fullBusy) return;
    const started = Date.now();
    const tick = window.setInterval(() => {
      setFullElapsed(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => {
      window.clearInterval(tick);
      setFullElapsed(0);
    };
  }, [fullBusy]);

  useEffect(() => () => fullAbort.current?.abort(), []);

  /** يُستدعى مع كل تعديل بشري على المسودة. */
  function markDraftChanged() {
    draftRevision.current += 1;
    if (fullEdit) setFullEditStale(true);
  }

  async function runFullEdit(draft: { storyId?: string; title: string; body: string }) {
    if (fullBusy) return;
    const draftBody = draft.body.trim();
    if (!draftBody) {
      setMessage({ kind: "err", text: "اكتب المتن أولًا ليعمل التحرير الشامل عليه." });
      return;
    }
    const controller = new AbortController();
    fullAbort.current = controller;
    fullStartRevision.current = draftRevision.current;
    setFullBusy(true);
    setFullEdit(null);
    setFullEditStale(false);
    setFullProgress({ ...INITIAL_FULL_PROGRESS, request: "active" });
    setMessage(null);
    let streamedResult: { fullEdit?: FullEditData } | null = null;

    try {
      const response = await fetch("/api/tahrir/ai/assist", {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tool: "full_edit", storyId: draft.storyId, title: draft.title, body: draftBody }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "تعذر التحرير الشامل.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type?: string;
            stage?: FullEditProgressStage;
            error?: string;
            data?: { fullEdit?: FullEditData };
          };
          if (event.type === "progress" && event.stage) {
            setFullProgress((current) => advanceFullProgress(current, event.stage!));
          } else if (event.type === "result" && event.data) {
            streamedResult = event.data;
          } else if (event.type === "error") {
            throw new Error(event.error ?? "تعذر التحرير الشامل.");
          }
        }

        if (done) break;
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setMessage({ kind: "ok", text: "أُوقف التحرير الذكي ولم يُطبّق أي تغيير." });
      } else {
        setMessage({
          kind: "err",
          text: error instanceof Error ? error.message : "تعذر التحرير الشامل.",
        });
      }
      setFullBusy(false);
      fullAbort.current = null;
      return;
    }

    setFullBusy(false);
    fullAbort.current = null;
    if (!streamedResult?.fullEdit) {
      setMessage({ kind: "err", text: "اكتمل الاتصال بلا نتيجة قابلة للمراجعة." });
      return;
    }
    setFullProgress({ request: "done", body: "done", pack: "done", guard: "done" });
    setFullEdit(streamedResult.fullEdit);
    setFullEditStale(draftRevision.current !== fullStartRevision.current);
  }

  function stopFullEdit() {
    fullAbort.current?.abort();
  }

  /** بعد التطبيق أو التجاهل. */
  function clearFullEdit() {
    setFullEdit(null);
    setFullEditStale(false);
  }

  return {
    fullEdit, fullBusy, fullElapsed, fullProgress, fullEditStale,
    revision: () => draftRevision.current,
    markDraftChanged, runFullEdit, stopFullEdit, clearFullEdit,
  };
}
