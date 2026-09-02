import Link from "next/link";

import { SeriesTag } from "@/components/tahrir/badges";
import { cn } from "@/lib/utils";

/**
 * صف مادة موحّد لقوائم اللوحة: شارة في البداية (اختيارية)، العنوان يأخذ العرض، ثم السلسلة والتوقيت/الكاتب.
 * الصف كله رابط إلى المحرر — مصدر واحد للقياسات بدل تكرارها في كل قائمة.
 */
export function StoryRow({
  href,
  title,
  leading,
  series,
  meta,
  className,
}: {
  href: string;
  title: string;
  leading?: React.ReactNode;
  series?: { name: string; color: string } | null;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "grid items-center gap-3 border-b border-border/70 px-4 py-3 transition-colors outline-none last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50",
        leading
          ? "grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
          : "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto]",
        className,
      )}
    >
      {leading}
      <span className="truncate text-sm font-semibold text-foreground">{title}</span>
      {series ? (
        <SeriesTag name={series.name} color={series.color} className="hidden sm:inline-flex" />
      ) : (
        <span className="hidden sm:inline" />
      )}
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{meta ?? "—"}</span>
    </Link>
  );
}
