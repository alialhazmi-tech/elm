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

/**
 * جدول اليوم: وقت، عقدة على خط عمودي (منشورة خضراء / القادمة بلون الهوية بنبضة خفيفة / لاحقة فارغة)،
 * ثم العنوان والحالة. القادمة تُبرز بخلفية خفيفة لأنها ما يهم الآن.
 */
export function TodayTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative grid px-4 py-2.5">
      <span aria-hidden className="absolute inset-y-4 start-[calc(1rem+54px+7px)] w-px bg-border" />
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className={cn(
              "grid grid-cols-[46px_16px_minmax(0,1fr)] items-start gap-x-2.5 rounded-lg px-2 py-2 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50",
              item.state === "next" && "bg-primary/8",
            )}
          >
            <span
              className={cn(
                "pt-0.5 font-display text-[13px] font-bold tabular-nums",
                item.state === "done" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {item.time}
            </span>
            <span className="relative flex h-5 items-center justify-center">
              <span
                aria-hidden
                className={cn(
                  "relative z-10 size-3 rounded-full border-2 border-input bg-card",
                  item.state === "done" && "border-(--t-ok) bg-(--t-ok)",
                  item.state === "next" && "border-primary bg-primary ring-4 ring-primary/20",
                )}
              />
            </span>
            <span className="grid min-w-0 leading-tight">
              <span className={cn("truncate text-sm font-semibold", item.state === "done" ? "text-foreground/85" : "text-foreground")}>
                {item.title}
              </span>
              <span className="text-xs text-muted-foreground">{item.meta}</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
