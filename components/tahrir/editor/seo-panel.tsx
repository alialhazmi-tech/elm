"use client";

import { useRef, useState } from "react";
import { SparklesIcon, XIcon } from "lucide-react";

import { GuardChip } from "@/components/tahrir/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SeoResult } from "@/lib/ai/editorial";
import { readAssistResponse } from "@/lib/ai/read-assist-response";
import { cn } from "@/lib/utils";

interface Props {
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  disabled: boolean;
  getDraft: () => { storyId?: string; title: string; body: string; revision: number };
  onSeoTitle: (value: string) => void;
  onSeoDescription: (value: string) => void;
  onAddKeyword: (value: string) => void;
  onRemoveKeyword: (value: string) => void;
  /** يُطبَّق بنقرة بشرية بعد عرض المقترح وحكم الحارس عليه. */
  onApply: (seo: Pick<SeoResult, "seoTitle" | "seoDescription" | "keywords">) => void;
}

function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span className={cn("text-[10.5px] tabular-nums", length > max ? "text-(--t-block)" : "text-muted-foreground")}>
      {length}/{max}
    </span>
  );
}

/** تبويب SEO: عنوان ووصف البحث بعدّادات، والكلمات المفتاحية رقائق — والتوليد من المتن مقترحٌ يُعتمد بنقرة. */
export function SeoPanel(props: Props) {
  const [keywordInput, setKeywordInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<{ seo: SeoResult; revision: number } | null>(null);
  const inFlight = useRef(false);

  async function generate() {
    if (inFlight.current || props.disabled) return;
    const draft = props.getDraft();
    if (!draft.body.trim()) { setError("أضف متن المادة أولًا ليُبنى SEO على محتواها."); return; }
    inFlight.current = true; setBusy(true); setError(""); setProposal(null);
    try {
      const response = await fetch("/api/tahrir/ai/assist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "seo", storyId: draft.storyId, title: draft.title, body: draft.body }),
      });
      const data = await readAssistResponse(response);
      const seo = data.seo;
      if (!seo || typeof seo.seoTitle !== "string" || !Array.isArray(seo.keywords) || !seo.guard) throw new Error("لم يعد المساعد بحزمة SEO صالحة. أعد التوليد.");
      setProposal({ seo, revision: draft.revision });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر توليد SEO.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  function apply() {
    if (!proposal || props.disabled || proposal.seo.guard.ok !== true) return;
    if (proposal.revision !== props.getDraft().revision) {
      setError("تغيّرت المسودة بعد طلب التوليد. أعد التوليد لحماية تعديلاتك."); return;
    }
    props.onApply({ seoTitle: proposal.seo.seoTitle, seoDescription: proposal.seo.seoDescription, keywords: proposal.seo.keywords });
    setProposal(null); setError("");
  }

  const blocking = proposal?.seo.guard.findings.find((finding) => finding.severity === "blocking");

  return (
    <div className="grid gap-3 p-3 text-right" dir="rtl">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-[13px] font-bold">SEO والكلمات المفتاحية</h2>
        <Button size="xs" variant="outline" className="ms-auto" onClick={generate} disabled={busy || props.disabled}>
          <SparklesIcon data-icon="inline-start" className={busy ? "animate-pulse" : undefined} />
          {busy ? "يولّد…" : "ولّد من المتن"}
        </Button>
      </div>
      {error ? <p role="alert" className="text-xs leading-relaxed text-destructive">{error}</p> : null}
      {proposal ? (
        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3" aria-label="حزمة SEO المقترحة">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">راجع المقترح ثم اعتمده في الحقول.</p>
            <Button type="button" size="xs" variant="ghost" onClick={() => { setProposal(null); setError(""); }}>إغلاق</Button>
          </div>
          <dl className="grid gap-1.5 text-[12.5px]">
            <div><dt className="text-[10.5px] text-muted-foreground">عنوان البحث</dt><dd className="leading-relaxed">{proposal.seo.seoTitle}</dd></div>
            <div><dt className="text-[10.5px] text-muted-foreground">وصف البحث</dt><dd className="leading-relaxed">{proposal.seo.seoDescription}</dd></div>
            <div><dt className="text-[10.5px] text-muted-foreground">الكلمات المفتاحية</dt><dd className="leading-relaxed">{proposal.seo.keywords.join("، ") || "—"}</dd></div>
          </dl>
          {proposal.seo.guard.ok ? (
            <GuardChip tone="ok" label={proposal.seo.guard.findings.length === 0 ? "مرّ على الحارس" : `${proposal.seo.guard.findings.length} ملاحظة`} />
          ) : (
            <GuardChip tone="block" label={`رفضه الحارس — ${blocking?.message.slice(0, 60) ?? ""}`} className="max-w-full whitespace-normal" />
          )}
          {proposal.seo.guard.findings.map((finding, index) => <p key={index} className="text-xs text-muted-foreground">{finding.message}</p>)}
          <Button type="button" size="xs" className="justify-self-end" disabled={props.disabled || proposal.seo.guard.ok !== true} onClick={apply}>
            اعتماد SEO
          </Button>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-title">عنوان البحث</Label>
          <Counter length={props.seoTitle.length} max={60} />
        </div>
        <Input
          id="seo-title"
          maxLength={90}
          value={props.seoTitle}
          onChange={(event) => props.onSeoTitle(event.target.value)}
          placeholder="يسقط للعنوان إن تُرك"
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-description">وصف البحث</Label>
          <Counter length={props.seoDescription.length} max={155} />
        </div>
        <Textarea
          id="seo-description"
          rows={3}
          maxLength={200}
          value={props.seoDescription}
          onChange={(event) => props.onSeoDescription(event.target.value)}
          placeholder="يسقط للموجز إن تُرك"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="seo-keyword">الكلمات المفتاحية</Label>
        <div className="flex flex-wrap gap-1.5">
          {props.keywords.map((keyword) => (
            <span key={keyword} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
              {keyword}
              <button
                type="button"
                aria-label={`حذف ${keyword}`}
                className="rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => props.onRemoveKeyword(keyword)}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <Input
          id="seo-keyword"
          value={keywordInput}
          placeholder="كلمة مفتاحية ثم Enter"
          onChange={(event) => setKeywordInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              props.onAddKeyword(keywordInput);
              setKeywordInput("");
            }
          }}
        />
      </div>
    </div>
  );
}
