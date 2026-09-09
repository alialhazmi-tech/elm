"use client";
import { useState } from "react";

type State = { status: "idle" } | { status: "loading" } | { status: "ready"; text: string } | { status: "error"; message: string };

/** النص السابق يُحمّل عند فتح النسخة فقط؛ القائمة لا تحمل متون كل النسخ. */
export function HistorySnapshot({ versionId }: { versionId: string }) {
  const [state, setState] = useState<State>({ status: "idle" });
  async function load() {
    if (state.status === "ready" || state.status === "loading") return;
    setState({ status: "loading" });
    try {
      const response = await fetch(`/api/tahrir/story/history/${encodeURIComponent(versionId)}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.text !== "string") throw new Error(result?.error ?? "تعذر تحميل النسخة.");
      setState({ status: "ready", text: result.text });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "تعذر تحميل النسخة." });
    }
  }
  return <details onToggle={event => { if (event.currentTarget.open) void load(); }}>
    <summary>عرض النص السابق</summary>
    {state.status === "loading" && <p className="text-sm text-muted-foreground">جارٍ تحميل النسخة…</p>}
    {state.status === "error" && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
    {state.status === "ready" && <p className="whitespace-pre-wrap">{state.text || "لا نص في هذه النسخة."}</p>}
  </details>;
}
