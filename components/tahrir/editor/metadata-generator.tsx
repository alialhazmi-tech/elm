"use client";

import { useRef, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MetadataResult } from "@/lib/ai/editorial";

export function MetadataGenerator({ disabled, lockedSection, getDraft, onApply, onBusyChange, sections, series, formats }: {
  disabled: boolean;
  lockedSection: string | null;
  getDraft: () => { title: string; body: string; revision: number };
  onApply: (data: MetadataResult) => void;
  onBusyChange: (busy: boolean) => void;
  sections: Array<[string, string]>; series: Array<{ slug: string; name: string }>; formats: Array<[string, string]>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<{ data: MetadataResult; revision: number } | null>(null);
  const lock = useRef(false);

  async function generate() {
    if (lock.current || disabled) return;
    setOpen(true); setError(""); setProposal(null);
    const draft = getDraft();
    if (!draft.body.trim()) { setError("أضف متن المادة أولًا لتوليد ملحقاتها."); return; }
    lock.current = true; setBusy(true); onBusyChange(true);
    try {
      const response = await fetch("/api/tahrir/ai/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool: "metadata", title: draft.title, body: draft.body }) });
      const data = await response.json();
      if (!response.ok || !data?.metadata) throw new Error(data?.error ?? "تعذر توليد الملحقات.");
      setProposal({ data: data.metadata, revision: draft.revision });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر الاتصال بالمساعد."); }
    finally { lock.current = false; setBusy(false); onBusyChange(false); }
  }
  function apply() {
    if (!proposal || disabled || busy || !proposal.data.excerpt.guard.ok || !proposal.data.seo.guard.ok) return;
    if (proposal.revision !== getDraft().revision) { setError("تغيّرت المسودة بعد طلب التوليد. أعد التوليد لحماية تعديلاتك."); return; }
    onApply(proposal.data); setOpen(false); setProposal(null);
  }
  const data = proposal?.data;
  const row = (label: string, value: string) => <div className="grid gap-1 border-b pb-2 last:border-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm leading-relaxed">{value}</dd></div>;
  return <>
    <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={generate}><SparklesIcon className="size-4" />{busy ? "جارٍ توليد الملحقات…" : "توليد الملحقات"}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl" dir="rtl">
        <DialogHeader><DialogTitle>ملحقات المادة</DialogTitle><DialogDescription>راجع الموجز وبيانات البحث والتصنيف، ثم اعتمدها في المسودة.</DialogDescription></DialogHeader>
        {busy && <p role="status" className="th-ai-shimmer rounded-md border p-3 text-sm">يقرأ المساعد المادة ويجهّز ملحقاتها…</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {data && <>
          <dl className="grid gap-3">
            {row("الموجز — قبل القراءة", data.excerpt.text)}
            {row("عنوان SEO", data.seo.seoTitle)}
            {row("وصف SEO", data.seo.seoDescription)}
            {row("الكلمات المفتاحية", data.seo.keywords.join("، "))}
            {row("القسم", sections.find(([key]) => key === (lockedSection ?? data.classify.section))?.[1] ?? (lockedSection ?? data.classify.section))}
            {row("شكل المادة", formats.find(([key]) => key === data.classify.format)?.[1] ?? data.classify.format)}
            {row("السلسلة", series.find(item => item.slug === data.classify.seriesSlug)?.name ?? "بلا سلسلة")}
          </dl>
          {lockedSection && <p className="text-xs text-muted-foreground">يبقى قسم المادة المعتمدة ثابتًا لحماية رابطها؛ تُطبّق بقية الملحقات.</p>}
          {[...data.excerpt.guard.findings, ...data.seo.guard.findings].map((finding, i) => <p key={i} className="text-xs text-muted-foreground">{finding.message}</p>)}
          <Button type="button" onClick={apply} disabled={disabled || busy || !data.excerpt.guard.ok || !data.seo.guard.ok}>اعتماد الملحقات</Button>
        </>}
        {!busy && <Button type="button" variant="outline" disabled={disabled} onClick={generate}>إعادة توليد الملحقات</Button>}
      </DialogContent>
    </Dialog>
  </>;
}
