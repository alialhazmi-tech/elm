"use client";

import { useEffect, useRef, useState } from "react";
import { ThumbsUp } from "lucide-react";

import { INTERACTION_EVENT, invalidateArticleInteraction, loadArticleInteraction, type InteractionState } from "./interaction-client";

export function useArticleInteraction(storyId: string) {
  const [state, setState] = useState<InteractionState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const sequence = useRef(0);
  useEffect(() => {
    let live = true;
    const load = async () => {
      const id = ++sequence.current;
      try {
        const data = await loadArticleInteraction(storyId);
        if (live && id === sequence.current) { setState(data); setError(""); }
      } catch { if (live && id === sequence.current) setError("تعذّر تحميل التفاعل. أعد المحاولة."); }
    };
    const changed = (event: Event) => { if ((event as CustomEvent).detail?.storyId === storyId) void load(); };
    void load();
    window.addEventListener(INTERACTION_EVENT, changed);
    window.addEventListener("focus", load);
    return () => { live = false; window.removeEventListener(INTERACTION_EVENT, changed); window.removeEventListener("focus", load); };
  }, [storyId]);

  const save = async (change: { liked: boolean } | { answer: number }) => {
    if (inFlight.current) return;
    inFlight.current = true; ++sequence.current; setBusy(true); setError("");
    try {
      if (!state) await loadArticleInteraction(storyId);
      const response = await fetch("/api/content/interactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, ...change }),
      });
      if (!response.ok) throw new Error(response.status === 429 ? "RATE_LIMITED" : "UNAVAILABLE");
      setState(await response.json());
      invalidateArticleInteraction(storyId);
      window.dispatchEvent(new CustomEvent(INTERACTION_EVENT, { detail: { storyId } }));
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "RATE_LIMITED" ? "طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة." : "لم نتمكن من تأكيد الحفظ. أعد المحاولة؛ لن يُحتسب التفاعل مرتين.");
    } finally { inFlight.current = false; setBusy(false); }
  };
  return { state, error, busy, save };
}

export function ArticleLikeButton({ storyId }: { storyId: string }) {
  const { state, error, busy, save } = useArticleInteraction(storyId);
  return <span>
    <button className={`sa-save${state?.liked ? " is-on" : ""}`} type="button" aria-pressed={state?.liked ?? false} disabled={busy || (!state && !error)} onClick={() => void save({ liked: !state?.liked })}>
      <ThumbsUp size={16} aria-hidden="true" /> {busy ? "جارٍ الحفظ…" : state?.liked ? "أعجبتني" : "أعجبني"}
    </button>
    {error && <span className="poll-note" role="status">{error}</span>}
  </span>;
}
