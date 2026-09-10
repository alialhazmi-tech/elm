import { cn } from "@/lib/utils";

export type GuardTone = "ok" | "warn" | "block";

/** شارة الحارس: نقطة + عدد المخالفات بلونها الدلالي؛ الرموز من طبقة .th فتعمل في الوضعين. */
export function GuardChip({ tone, label, className }: { tone: GuardTone; label: string; className?: string }) {
  const styles: Record<GuardTone, string> = {
    ok: "bg-(--t-ok-bg) text-(--t-ok)",
    warn: "bg-(--t-warn-bg) text-(--t-warn)",
    block: "bg-(--t-block-bg) text-(--t-block)",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 font-display text-[11px] font-bold whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current",
        styles[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export type StatusKey = "published" | "review" | "scheduled" | "draft" | "archived";

/** حالة المادة كلوحة صغيرة بزوايا خفيفة — تميّزها عن شارة الحارس المستديرة. */
export function StatusPill({ status, label, className }: { status: string; label: string; className?: string }) {
  const styles: Record<StatusKey, string> = {
    published: "bg-(--t-ok-bg) text-(--t-ok)",
    review: "bg-(--t-warn-bg) text-(--t-warn)",
    scheduled: "bg-(--t-sug-bg) text-(--t-sug)",
    draft: "bg-(--t-draft-bg) text-(--t-draft)",
    archived: "border border-border bg-muted text-muted-foreground line-through decoration-muted-foreground/60",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 font-display text-[11px] font-bold whitespace-nowrap",
        styles[(status as StatusKey) in styles ? (status as StatusKey) : "draft"],
        className,
      )}
    >
      {label}
    </span>
  );
}

/** السلسلة: مربّع صغير بلونها + الاسم؛ اللون يأتي من SERIES لا من الرموز. */
export function SeriesTag({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap", className)}>
      <i aria-hidden className="size-2 rounded-[2px]" style={{ background: color }} />
      {name}
    </span>
  );
}
