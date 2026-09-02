import Link from "next/link";

import { cn } from "@/lib/utils";

export interface TimelineItem {
  id: string;
  time: string;
  title: string;
  href: string;
  state: "done" | "next" | "later";
  meta: string;
}

/** جدول اليوم: وقت، عقدة (منشورة خضراء / القادمة بلون الهوية / لاحقة فارغة)، ثم العنوان والحالة. */
export function TodayTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="grid px-4 py-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="grid grid-cols-[44px_12px_1fr] items-start gap-x-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
        >
          <span className="pt-0.5 font-display text-xs font-bold text-muted-foreground tabular-nums">{item.time}</span>
          <span
            aria-hidden
            className={cn(
              "mt-1.5 size-2.5 rounded-full border-2 border-input bg-card",
              item.state === "done" && "border-(--t-ok) bg-(--t-ok)",
              item.state === "next" && "border-primary bg-primary",
            )}
          />
          <span className="grid min-w-0 leading-tight">
            <span className="truncate text-[12.5px] font-semibold">{item.title}</span>
            <span className="text-[11px] text-muted-foreground">{item.meta}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
