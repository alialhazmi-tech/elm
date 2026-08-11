"use client";

import { useState } from "react";

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

export function AiPanel({ getDraft, onInsertTitle, onInsertExcerpt, onReplaceBody, onClassify }: Props) {
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
    <div className="th-panel">
      <div className="th-guard-hd">
        <span style={{ fontSize: 15 }}>✦</span>
        <h2>محرر العلم — المساعد الذكي</h2>
      </div>

      <div className="th-ai-act">
        {TOOLS.map(([tool, label]) => (
          <button key={tool} className={active === tool ? "on" : ""} onClick={() => run(tool)}>
            {label}
          </button>
        ))}
      </div>

      {busy && <div className="th-ai-spin">✦ المساعد يعمل ويُفحص مخرجه بالحارس…</div>}
      {error && (
        <div className="th-msg err" style={{ padding: "10px 16px" }}>
          {error}
        </div>
      )}

      {result?.suggestions && active && (
        <div className="th-ai-sug">
          <div className="sh">{TOOL_HINTS[active]}</div>
          {result.suggestions.map((suggestion, index) => (
            <div className="th-ai-card" key={index}>
              <div className="tx">{suggestion.text}</div>
              <div className="row">
                {suggestion.guard.ok ? (
                  <span className="th-gchip ok">
                    {suggestion.guard.findings.length === 0
                      ? "سليم"
                      : `${suggestion.guard.findings.length} ملاحظة`}
                  </span>
                ) : (
                  <span className="th-gchip block">
                    رفضه الحارس — {suggestion.guard.findings.find((f) => f.severity === "blocking")?.message.slice(0, 60)}
                  </span>
                )}
                {suggestion.guard.ok && (
                  <button className="th-ai-ins" onClick={() => insert(active, suggestion.text)}>
                    {active === "improve" ? "اعتمد التحسين" : active === "proofread" ? "اعتمد التدقيق" : "أدرج"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {result?.classify && (
        <div className="th-ai-sug">
          <div className="sh">التصنيف المقترح</div>
          <div className="th-ai-card">
            <div className="row" style={{ marginTop: 0 }}>
              <span className="th-serchip" style={{ "--sc": "var(--t-sug)" } as React.CSSProperties}>
                {result.classify.seriesSlug ?? "بلا سلسلة"}
              </span>
              <span className="th-serchip" style={{ "--sc": "var(--t-ink3)" } as React.CSSProperties}>
                {result.classify.section}
              </span>
              <span className="th-serchip" style={{ "--sc": "var(--t-ink3)" } as React.CSSProperties}>
                {result.classify.format}
              </span>
              <button className="th-ai-ins" onClick={() => { onClassify(result.classify!); setResult(null); setActive(null); }}>
                طبّق
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="th-ai-foot">
        <b>الحوكمة:</b> الدستور يُحقن في كل استدعاء · كل مخرج يمر على الحارس قبل عرضه · الإدراج بنقرة
        منك ويُدوَّن · <b>لا ينشر الذكاء شيئًا — الاعتماد بشري دائمًا.</b>
      </div>
    </div>
  );
}
