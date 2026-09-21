import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** منحنى صغير من قيم يومية — مسار خطي فوق تعبئة خافتة ونقطة على آخر قيمة. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 84;
  const height = 30;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (width - 4) / (values.length - 1) : 0;
  const points = values.map((value, index) => [2 + index * step, height - 3 - (value / max) * (height - 8)]);
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1] ?? [width - 2, height - 3];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden style={{ color }}>
      <path d={`${line} L${lastX.toFixed(1)} ${height} L2 ${height} Z`} fill="currentColor" opacity="0.12" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill="currentColor" />
    </svg>
  );
}

export type StatTone = "ok" | "warn" | "block";

const TONE_TEXT: Record<StatTone, string> = {
  ok: "text-(--t-ok)",
  warn: "text-(--t-warn)",
  block: "text-(--t-block)",
};

const TONE_ICON: Record<StatTone, string> = {
  ok: "bg-(--t-ok-bg) text-(--t-ok)",
  warn: "bg-(--t-warn-bg) text-(--t-warn)",
  block: "bg-(--t-block-bg) text-(--t-block)",
};

/**
 * بلاطة مؤشر: أيقونة موحّدة + تسمية، الرقم هو البطل، وسطر توضيح هادئ يأخذ اللون الدلالي عند الحاجة.
 * الصفر يُرسم باهتًا (حالة هادئة لا تنافس الأرقام الحية)، والبلاطة رابط عند تمرير href.
 */
export function StatTile({
  label,
  value,
  hint,
  tone,
  series,
  color = "var(--t-sug)",
  icon: Icon,
  href,
  className,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: StatTone;
  series?: number[];
  color?: string;
  icon?: LucideIcon;
  href?: string;
  className?: string;
}) {
  const body = (
    <CardContent className="grid gap-3 p-4">
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
              tone && TONE_ICON[tone],
            )}
            aria-hidden
          >
            <Icon className="size-4" />
          </span>
        ) : null}
        <span className="truncate text-[13px] font-semibold text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <span
          className={cn(
            "font-display text-[30px] leading-none font-extrabold tracking-tight tabular-nums",
            value === 0 ? "text-muted-foreground/60" : "text-foreground",
          )}
        >
          {value.toLocaleString("en-US")}
        </span>
        {series ? <Sparkline values={series} color={color} /> : null}
      </div>
      <span className={cn("line-clamp-2 text-xs leading-snug text-muted-foreground sm:line-clamp-1", tone && `font-semibold ${TONE_TEXT[tone]}`)}>{hint}</span>
    </CardContent>
  );

  return (
    <Card
      className={cn(
        "gap-0 py-0 transition-[border-color,box-shadow] duration-150",
        href &&
          "hover:border-primary/50 hover:shadow-sm has-[a:focus-visible]:border-primary has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/40",
        className,
      )}
    >
      {href ? (
        <Link href={href} className="block outline-none" aria-label={`${label}: ${value}`}>
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}
