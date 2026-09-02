"use client";

import { SparklesIcon, SquareIcon } from "lucide-react";

import { GuardChip } from "@/components/tahrir/badges";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProgressState = "waiting" | "active" | "done";

export interface FullEditProgress {
  request: ProgressState;
  body: ProgressState;
  pack: ProgressState;
  guard: ProgressState;
}

interface GuardVerdict {
  ok: boolean;
  findings: Array<{ ruleId: string; severity: string; message: string }>;
}

export interface FullEditData {
  title: { text: string; guard: GuardVerdict };
  excerpt: { text: string; guard: GuardVerdict };
  body: { text: string; guard: GuardVerdict };
  seo: { seoTitle: string; seoDescription: string; keywords: string[]; guard: GuardVerdict };
  classify: { seriesSlug: string | null; section: string; format: string };
}

const STEPS: Array<[keyof FullEditProgress, string]> = [
  ["request", "تجهيز الطلب"],
  ["body", "تحرير المتن"],
  ["pack", "العنوان وSEO"],
  ["guard", "فحص السياسة"],
];

/** شريط الدعوة إلى التحرير الشامل — يظهر حين لا يعمل التحليل. */
export function FullEditBar({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-y bg-muted/30 px-5 py-2.5">
      <SparklesIcon className="size-4 shrink-0 text-primary" />
      <span className="grid min-w-0 flex-1 leading-tight">
        <b className="text-[12.5px]">تحرير ذكي شامل</b>
        <span className="text-[11px] text-muted-foreground">
          يحرر المتن ويقترح العنوان والموجز وSEO والتصنيف — ثم يعرضه عليك قبل التطبيق.
        </span>
      </span>
      <Button size="sm" variant="outline" onClick={onStart}>
        ابدأ التحليل
      </Button>
    </div>
  );
}

/** تقدم التحليل بمراحله الفعلية المبثوثة من الخادم، مع عدّاد وإيقاف. */
export function FullEditProgressView({
  progress,
  elapsed,
  onStop,
}: {
  progress: FullEditProgress;
  elapsed: number;
  onStop: () => void;
}) {
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  return (
    <div className="th-full-progress grid gap-3 border-y bg-muted/30 px-5 py-3" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="th-ai-orb size-3 rounded-full bg-primary" aria-hidden="true" />
        <span className="grid min-w-0 flex-1 leading-tight">
          <b className="text-[12.5px]">محرر العلم يعمل على المسودة</b>
          <span className="text-[11px] text-muted-foreground">يمكنك متابعة الكتابة؛ لن يُطبّق أي تغيير دون موافقتك.</span>
        </span>
        <span className="font-display text-xs text-muted-foreground tabular-nums">
          {minutes}:{seconds}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" aria-label="مراحل التحرير الذكي">
        {STEPS.map(([key, label]) => (
          <span
            key={key}
            className={cn(
              "rounded-md border px-2 py-1 text-center text-[11px]",
              progress[key] === "waiting" && "text-muted-foreground",
              progress[key] === "active" && "th-ai-shimmer border-primary/50 bg-primary/10 font-semibold",
              progress[key] === "done" && "border-(--t-ok)/40 bg-(--t-ok-bg) text-(--t-ok)",
            )}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>قد يطول قليلًا مع المواد الكبيرة.</span>
        <Button size="xs" variant="ghost" className="ms-auto" onClick={onStop}>
          <SquareIcon data-icon="inline-start" />
          إيقاف
        </Button>
      </div>
    </div>
  );
}

/** المقترح الكامل — يُطبَّق بنقرة بشرية، ويُقفل إن تغيّرت المسودة أثناء التحليل. */
export function FullEditProposal({
  fullEdit,
  stale,
  onApply,
  onRerun,
  onDismiss,
}: {
  fullEdit: FullEditData;
  stale: boolean;
  onApply: () => void;
  onRerun: () => void;
  onDismiss: () => void;
}) {
  const passed = fullEdit.body.guard.ok && fullEdit.title.guard.ok;
  const row = (label: string, value: React.ReactNode, block = false) => (
    <div className={cn("grid gap-1 text-[12.5px]", block ? "" : "sm:grid-cols-[64px_1fr]")}>
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <span className={cn("leading-relaxed", block && "max-h-64 overflow-y-auto rounded-md border bg-card p-3 whitespace-pre-wrap")}>
        {value}
      </span>
    </div>
  );
  return (
    <div className="grid gap-3 border-y bg-muted/30 px-5 py-3">
      <div className="flex items-center gap-2">
        <b className="text-[12.5px]">مقترح التحرير الشامل</b>
        <GuardChip tone={passed ? "ok" : "block"} label={passed ? "مرّ على الحارس" : "فيه مخالفات — راجع"} />
      </div>
      {stale ? (
        <div role="alert" className="rounded-md bg-(--t-warn-bg) px-3 py-2 text-xs text-(--t-warn)">
          تغيّرت المسودة أثناء التحليل. أعد التحليل على النسخة الحالية لتجنب استبدال تعديلاتك الجديدة.
        </div>
      ) : null}
      {row("العنوان", <b>{fullEdit.title.text}</b>)}
      {row("الموجز", fullEdit.excerpt.text)}
      {row("المتن", fullEdit.body.text, true)}
      {row("SEO", `${fullEdit.seo.seoTitle} · ${fullEdit.seo.seoDescription}`)}
      {row("الكلمات", fullEdit.seo.keywords.join("، "))}
      {row("التصنيف", `${fullEdit.classify.seriesSlug ?? "بلا سلسلة"} · ${fullEdit.classify.section} · ${fullEdit.classify.format}`)}
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" onClick={onApply} disabled={stale}>
          {stale ? "التطبيق متوقف لحماية تعديلاتك" : "طبّق الكل — القرار لك"}
        </Button>
        {stale ? (
          <Button size="sm" variant="outline" onClick={onRerun}>
            أعد التحليل
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          تجاهل
        </Button>
      </div>
    </div>
  );
}
