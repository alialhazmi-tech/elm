"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";

import { GuardChip } from "@/components/tahrir/badges";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Suggestion {
  text: string;
  guard: {
    ok: boolean;
    findings: Array<{ ruleId: string; severity: string; message: string }>;
  };
}

interface AssistResult {
  suggestions?: Suggestion[];
  classify?: { seriesSlug: string | null; section: string; format: string };
}

interface Props {
  guardEnabled: boolean;
  getDraft: () => { title: string; body: string; selection?: string };
  onInsertTitle: (text: string) => void;
  onInsertExcerpt: (text: string) => void;
  onReplaceBody: (text: string, selectionOnly: boolean) => void;
  onClassify: (c: { seriesSlug: string | null; section: string; format: string }) => void;
}

const TOOLS: Array<[string, string]> = [
  ["headlines", "اقترح عناوين"],
  ["excerpt", "ولّد قبل القراءة"],
  ["improve", "حسّن المحدد"],
  ["proofread", "دقق لغويًا"],
  ["classify", "صنّف المادة"],
];

const TOOL_HINTS: Record<string, string> = {
  headlines: "عناوين مقترحة — كلٌّ فُحص بالحارس قبل عرضه",
  excerpt: "«قبل القراءة» المقترحة",
  improve: "المقطع المحسّن — اعتماده بنقرة",
  proofread: "النص المدقق كاملًا",
};

/** مساعد «محرر العلم»: يقترح فقط، والإدراج بنقرة بشرية — لا ينشر شيئًا. */
export function AiPanel({ guardEnabled, getDraft, onInsertTitle, onInsertExcerpt, onReplaceBody, onClassify }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AssistResult | null>(null);
  const [error, setError] = useState("");
  const [usedSelection, setUsedSelection] = useState(false);

  async function run(tool: string) {
    if (busy) return;
    const draft = getDraft();
    if (!draft.title.trim() && !draft.body.trim()) {
      setError("اكتب شيئًا أولًا ليعمل المساعد عليه.");
      return;
    }
    setActive(tool);
    setBusy(true);
    setError("");
    setResult(null);
    setUsedSelection(tool === "improve" && Boolean(draft.selection));

    const response = await fetch("/api/tahrir/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, ...draft }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError(data?.error ?? "تعذر الاتصال بالمساعد.");
      return;
    }
    setResult(data as AssistResult);
  }

  function insert(tool: string, text: string) {
    if (tool === "headlines") onInsertTitle(text);
    else if (tool === "excerpt") onInsertExcerpt(text);
    else if (tool === "improve") onReplaceBody(text, usedSelection);
    else if (tool === "proofread") onReplaceBody(text, false);
    setResult(null);
    setActive(null);
  }

  return (
    <div className="grid gap-3 p-3 text-right" dir="rtl">
      <div className="flex items-center gap-2">
        <SparklesIcon className="size-4 text-primary" />
        <h2 className="font-display text-[13px] font-bold">محرر العلم — المساعد الذكي</h2>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TOOLS.map(([tool, label]) => (
          <Button
            key={tool}
            size="xs"
            variant={active === tool ? "default" : "outline"}
            disabled={busy}
            onClick={() => run(tool)}
          >
            {label}
          </Button>
        ))}
      </div>

      {busy ? (
        <div className="th-ai-shimmer rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          ✦ {guardEnabled ? "المساعد يعمل ويُفحص مخرجه بالحارس…" : "المساعد يعمل — فحص الحارس معطّل من إعدادات النظام…"}
        </div>
      ) : null}
      {error ? <div className="rounded-md bg-(--t-block-bg) px-3 py-2 text-xs text-(--t-block)">{error}</div> : null}

      {result?.suggestions && active ? (
        <div className="grid gap-2">
          <div className="text-[11px] font-semibold text-muted-foreground">{TOOL_HINTS[active]}</div>
          {result.suggestions.map((suggestion, index) => {
            const blocking = suggestion.guard.findings.find((finding) => finding.severity === "blocking");
            return (
              <div key={index} className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{suggestion.text}</div>
                <div className="flex flex-wrap items-center gap-2">
                  {suggestion.guard.ok ? (
                    <GuardChip
                      tone="ok"
                      label={!guardEnabled ? "فحص الحارس معطّل" : suggestion.guard.findings.length === 0 ? "سليم" : `${suggestion.guard.findings.length} ملاحظة`}
                    />
                  ) : (
                    <GuardChip tone="block" label={`رفضه الحارس — ${blocking?.message.slice(0, 60) ?? ""}`} className="max-w-full whitespace-normal" />
                  )}
                  {suggestion.guard.ok ? (
                    <Button size="xs" className="ms-auto" onClick={() => insert(active, suggestion.text)}>
                      {active === "improve" ? "اعتمد التحسين" : active === "proofread" ? "اعتمد التدقيق" : "أدرج"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {result?.classify ? (
        <div className="grid gap-2">
          <div className="text-[11px] font-semibold text-muted-foreground">التصنيف المقترح</div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/30 p-3 text-xs">
            <span className={cn("rounded-md bg-(--t-sug-bg) px-2 py-0.5 font-semibold text-(--t-sug)")}>
              {result.classify.seriesSlug ?? "بلا سلسلة"}
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5">{result.classify.section}</span>
            <span className="rounded-md bg-muted px-2 py-0.5">{result.classify.format}</span>
            <Button
              size="xs"
              className="ms-auto"
              onClick={() => {
                onClassify(result.classify!);
                setResult(null);
                setActive(null);
              }}
            >
              طبّق
            </Button>
          </div>
        </div>
      ) : null}

      <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
        <b className="text-foreground">الحوكمة:</b> الدستور يُحقن في كل استدعاء · كل مخرج يمر على الحارس قبل عرضه ·
        الإدراج بنقرة منك ويُدوَّن · <b className="text-foreground">لا ينشر الذكاء شيئًا — الاعتماد بشري دائمًا.</b>
      </p>
    </div>
  );
}
