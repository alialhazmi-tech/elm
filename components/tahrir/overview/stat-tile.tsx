import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** منحنى صغير من قيم يومية — مسار خطي فوق تعبئة خافتة ونقطة على آخر قيمة. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 76;
  const height = 28;
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

export function StatTile({
  label,
  value,
  hint,
  tone,
  series,
  color = "var(--t-sug)",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "ok" | "warn" | "block";
  series?: number[];
  color?: string;
}) {
  return (
    <Card className="gap-0 py-0 transition-all duration-150 hover:shadow-sm hover:border-border">
      <CardContent className="grid grid-cols-[1fr_auto] items-end gap-x-3 gap-y-1 p-4">
        <span className="col-span-2 text-xs font-medium text-muted-foreground">{label}</span>
        <span className="font-display text-[28px] leading-none font-extrabold tracking-tight tabular-nums">{value}</span>
        {series ? <Sparkline values={series} color={color} /> : <span />}
        <span
          className={cn(
            "col-span-2 mt-1 text-[11.5px] text-muted-foreground",
            tone === "ok" && "font-semibold text-(--t-ok)",
            tone === "warn" && "font-semibold text-(--t-warn)",
            tone === "block" && "font-semibold text-(--t-block)",
          )}
        >
          {hint}
        </span>
      </CardContent>
    </Card>
  );
}
