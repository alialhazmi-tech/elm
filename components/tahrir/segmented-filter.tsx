import Link from "next/link";

import { cn } from "@/lib/utils";

export interface SegmentedOption<V extends string = string> {
  value: V;
  label: string;
  /** عدد يُعرض بعد التسمية بأرقام لاتينية. */
  count?: number;
}

export type SegmentedFilterProps<V extends string> = {
  options: ReadonlyArray<SegmentedOption<V>>;
  value: V;
  ariaLabel: string;
  className?: string;
} & (
  | { onValueChange: (value: V) => void; hrefFor?: never }
  | { hrefFor: (value: V) => string; onValueChange?: never }
);

const ITEM =
  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 font-display text-xs font-semibold whitespace-nowrap transition-colors";
const ACTIVE = "bg-card text-foreground shadow-xs";
const IDLE = "text-muted-foreground hover:text-foreground";

/**
 * شريط تصفية مقسّم (الكل/فعّال/معلّق …) بشكل واحد في كل الشاشات: أزرار عند التصفية العميلية،
 * وروابط عند التصفية في الاستعلام. يلتف على الجوال بدل أن يقصّ خارج الشاشة.
 */
export function SegmentedFilter<V extends string>({ options, value, ariaLabel, className, ...mode }: SegmentedFilterProps<V>) {
  const shell = cn("inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-border/80 bg-muted/30 p-0.5", className);

  if ("hrefFor" in mode && mode.hrefFor) {
    const { hrefFor } = mode;
    return (
      <nav aria-label={ariaLabel} className={shell}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Link key={option.value} href={hrefFor(option.value)} aria-current={active ? "page" : undefined} className={cn(ITEM, active ? ACTIVE : IDLE)}>
              {option.label}
              {option.count !== undefined ? <Count active={active} value={option.count} /> : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  const { onValueChange } = mode as { onValueChange: (value: V) => void };
  return (
    <div role="group" aria-label={ariaLabel} className={shell}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={cn(ITEM, active ? ACTIVE : IDLE)}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
            {option.count !== undefined ? <Count active={active} value={option.count} /> : null}
          </button>
        );
      })}
    </div>
  );
}

function Count({ value, active }: { value: number; active: boolean }) {
  return <span className={cn("text-[10px] tabular-nums", active ? "text-primary" : "text-muted-foreground")}>{value}</span>;
}
