"use client";

import { EXCERPT_MAX_CHARS, excerptLength } from "@/lib/content/excerpt";

import { useRef, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiSuggestion } from "@/lib/ai/editorial";
import { readAssistResponse } from "@/lib/ai/read-assist-response";

interface Props {
  tool: "headlines" | "excerpt";
  getDraft: () => { storyId?: string; title: string; body: string; revision: number };
  onApply: (text: string) => void;
  disabled: boolean;
}

/** الاقتراح مستقل عن الحقل؛ لا يُدرج إلا بقرار المحرر وعلى نفس نسخة المسودة. */
export function FieldGenerator({ tool, getDraft, onApply, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<{ revision: number; suggestions: AiSuggestion[] } | null>(null);
  const inFlight = useRef(false);
  const label = tool === "headlines" ? "توليد العنوان" : "توليد الموجز الذكي";

  async function generate() {
    if (inFlight.current || disabled) return;
    const draft = getDraft();
    if (!draft.body.trim()) { setError("أضف متن المادة أولًا ليكون التوليد مبنيًا على محتواها."); return; }
    inFlight.current = true; setBusy(true); setError(""); setProposal(null);
    try {
      const response = await fetch("/api/tahrir/ai/assist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, storyId: draft.storyId, title: draft.title, body: draft.body }),
      });
      const data = await readAssistResponse(response);
      const suggestions: AiSuggestion[] = Array.isArray(data.suggestions) ? data.suggestions.filter((s: AiSuggestion) => typeof s?.text === "string" && s.text.trim() && s.guard && Array.isArray(s.guard.findings)) : [];
      if (!suggestions.length) throw new Error("لم يعد المساعد باقتراح صالح. أعد التوليد.");
      setProposal({ revision: draft.revision, suggestions });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر الاتصال بالمساعد.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  function apply(suggestion: AiSuggestion) {
    if (disabled || !proposal || suggestion.guard.ok !== true) return;
    if (proposal.revision !== getDraft().revision) {
      setError("تغيّرت المسودة بعد طلب التوليد. أعد التوليد لحماية تعديلاتك."); return;
    }
    onApply(suggestion.text); setProposal(null); setError("");
  }

  return <div className="grid gap-2 pt-1">
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="xs" variant="outline" className="border-(--t-ai-line) bg-(--t-ai) text-(--t-warn) hover:bg-(--t-ai) hover:text-(--t-warn)" disabled={busy || disabled} onClick={generate}>
        <SparklesIcon className={busy ? "size-3.5 animate-pulse" : "size-3.5"} />
        {busy ? "جارٍ التوليد…" : label}
      </Button>
      {busy && <span role="status" className="text-xs text-muted-foreground">يقرأ المساعد متن المادة ويجهّز الاقتراح…</span>}
    </div>
    {error && <p role="alert" className="text-xs leading-relaxed text-destructive">{error}</p>}
    {proposal && <div className="grid gap-2 rounded-lg border bg-muted/30 p-3" aria-label={tool === "headlines" ? "العناوين المقترحة" : "الموجز المقترح"}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">راجع الاقتراح ثم أدرجه في الحقل.</p>
        <Button type="button" size="xs" variant="ghost" onClick={() => { setProposal(null); setError(""); }}>إغلاق</Button>
      </div>
      {proposal.suggestions.map((suggestion, index) => {
        const tooLong = tool === "headlines" ? suggestion.text.trim().split(/\s+/u).length > 10 : excerptLength(suggestion.text) > EXCERPT_MAX_CHARS;
        return <div key={index} className="grid gap-2 rounded-md border bg-background p-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{suggestion.text}</p>
          {suggestion.guard.findings.map((finding, i) => <p key={i} className="text-xs text-muted-foreground">{finding.message}</p>)}
          {tooLong && <p className="text-xs text-destructive">الاقتراح يتجاوز الحد المسموح. أعد التوليد.</p>}
          <Button type="button" size="xs" className="justify-self-end" disabled={disabled || tooLong || suggestion.guard.ok !== true} onClick={() => apply(suggestion)}>
            {tool === "headlines" ? "اعتماد العنوان" : "اعتماد الموجز"}
          </Button>
        </div>;
      })}
    </div>}
  </div>;
}
