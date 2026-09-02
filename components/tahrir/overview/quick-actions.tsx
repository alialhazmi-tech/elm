import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  /** عدد حي يظهر بجانب التسمية (طابور الاعتماد مثلًا). */
  count?: number;
  /** الإجراء الأبرز بينها — يأخذ لون الهوية؛ الباقي أزرار ثانوية. */
  primary?: boolean;
}

/** الإجراءات السريعة: أزرار ثانوية موحّدة بأيقونة وعدد اختياري — الأساسي واحد فقط إن وُجد. */
export function QuickActions({ actions, className }: { actions: QuickAction[]; className?: string }) {
  if (actions.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {actions.map((action) => (
        <Button
          key={action.href}
          asChild
          variant={action.primary ? "default" : "outline"}
          className={cn("font-semibold", action.primary && "font-display shadow-sm shadow-primary/25")}
        >
          <Link href={action.href}>
            <action.icon data-icon="inline-start" />
            {action.label}
            {action.count && action.count > 0 ? (
              <span
                className={cn(
                  "ms-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-display text-[11px] font-bold tabular-nums",
                  action.primary ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary text-primary-foreground",
                )}
              >
                {action.count}
              </span>
            ) : null}
          </Link>
        </Button>
      ))}
    </div>
  );
}
