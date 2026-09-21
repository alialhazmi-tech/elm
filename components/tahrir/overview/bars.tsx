import { cn } from "@/lib/utils";

export interface BarRow {
  label: string;
  count: number;
  color: string;
  /** ملاحظة صغيرة بعد العدد (مثل «+12 هذا الأسبوع»). */
  note?: string;
}

/** أشرطة أفقية للتوزيع: تسمية ثابتة العرض، شريط بلون البند، والعدد بأرقام جدولية — مشتركة بين النظرة والإحصاءات. */
export function Bars({
  rows,
  max,
  labelWidth = 84,
  className,
}: {
  rows: BarRow[];
  max: number;
  labelWidth?: number;
  className?: string;
}) {
  const safeMax = Math.max(1, max);
  return (
    <div className={cn("grid gap-2.5 px-4 py-3.5", className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid items-center gap-3 text-[13px]"
          style={{ gridTemplateColumns: `${labelWidth}px minmax(0,1fr) auto` }}
        >
          <span className="truncate text-foreground">{row.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <i
              className="block h-full rounded-full transition-[width] duration-300"
              style={{ width: `${Math.max(row.count > 0 ? 2 : 0, (row.count / safeMax) * 100)}%`, background: row.color }}
            />
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <b className="min-w-7 text-start font-display text-xs font-bold text-foreground tabular-nums">
              {row.count.toLocaleString("en-US")}
            </b>
            {row.note ? <span className="text-[11px] text-muted-foreground tabular-nums">{row.note}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}
