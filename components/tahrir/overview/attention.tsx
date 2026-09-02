import Link from "next/link";
import { AlertTriangleIcon, ArrowLeftIcon, CircleCheckIcon, ClockIcon, ShieldAlertIcon, type LucideIcon } from "lucide-react";

import type { GuardTone } from "@/components/tahrir/badges";
import { cn } from "@/lib/utils";

export type AttentionTone = GuardTone | "sug";

export interface AttentionItem {
  id: string;
  tone: AttentionTone;
  /** العنوان القصير للبند — ما الذي يحتاج الانتباه. */
  label: string;
  /** تفصيل صغير اختياري (عنوان مادة، موعد…). */
  detail?: string;
  href: string;
  icon?: LucideIcon;
}

const TONE_ICON: Record<AttentionTone, LucideIcon> = {
  block: ShieldAlertIcon,
  warn: AlertTriangleIcon,
  sug: ClockIcon,
  ok: CircleCheckIcon,
};

const TONE_STYLE: Record<AttentionTone, string> = {
  block: "bg-(--t-block-bg) text-(--t-block)",
  warn: "bg-(--t-warn-bg) text-(--t-warn)",
  sug: "bg-(--t-sug-bg) text-(--t-sug)",
  ok: "bg-(--t-ok-bg) text-(--t-ok)",
};

/**
 * شريط «يحتاج انتباهك»: ما يعلق الآن (مخالفات قاطعة، طابور الاعتماد، حقوق الصور، الموعد التالي).
 * حين لا يعلق شيء يُعرض سطر هادئ واحد بدل لوحات فارغة تستهلك الشاشة.
 */
export function AttentionBar({ items, calmMessage }: { items: AttentionItem[]; calmMessage: string }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-(--t-ok)/25 bg-(--t-ok-bg) px-4 py-2.5 text-[13px] text-(--t-ok)">
        <CircleCheckIcon className="size-4 shrink-0" aria-hidden />
        <span className="font-semibold">{calmMessage}</span>
      </div>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]" aria-label="يحتاج انتباهك">
      {items.map((item) => {
        const Icon = item.icon ?? TONE_ICON[item.tone];
        return (
          <li key={item.id} className="min-w-0">
            <Link
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                TONE_STYLE[item.tone],
                "hover:border-current/25",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-[13px] font-bold">{item.label}</span>
                {item.detail ? <span className="truncate text-xs opacity-80">{item.detail}</span> : null}
              </span>
              <ArrowLeftIcon className="size-4 shrink-0 opacity-60 transition-transform group-hover:-translate-x-0.5" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
