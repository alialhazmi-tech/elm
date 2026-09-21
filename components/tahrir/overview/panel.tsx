import Link from "next/link";
import { ArrowLeftIcon, InboxIcon, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * لوحة اللوحة: رأس رفيع (أيقونة اختيارية + عنوان + عدد اختياري) ورابط «الكل» أو ملاحظة في نهاية السطر،
 * والمحتوى صفوف بلا حشو إضافي. تُستعمل في نظرة اليوم والجدولة والسلاسل والإحصاءات.
 */
export function Panel({
  title,
  href,
  hrefLabel,
  aside,
  icon,
  count,
  className,
  children,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  aside?: React.ReactNode;
  icon?: LucideIcon;
  count?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <PanelHeader title={title} href={href} hrefLabel={hrefLabel} aside={aside} icon={icon} count={count} />
      {children}
    </Card>
  );
}

export function PanelHeader({
  title,
  href,
  hrefLabel,
  aside,
  icon: Icon,
  count,
  className,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  aside?: React.ReactNode;
  icon?: LucideIcon;
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-12 items-center gap-2.5 border-b border-border/80 bg-muted/25 px-4 py-2", className)}>
      {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
      <h2 className="shrink-0 font-display text-[15px] leading-snug font-bold tracking-tight text-foreground">{title}</h2>
      {typeof count === "number" ? (
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-display text-[11px] font-bold tabular-nums",
            count > 0 ? "bg-primary/15 text-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
      {aside ? <span className="ms-auto min-w-0 truncate text-xs text-muted-foreground">{aside}</span> : null}
      {href ? (
        <Button
          asChild
          variant="ghost"
          size="xs"
          className={cn("-me-1.5 font-semibold text-(--t-sug) hover:text-(--t-sug)", !aside && "ms-auto")}
        >
          <Link href={href}>
            {hrefLabel ?? "الكل"}
            <ArrowLeftIcon data-icon="inline-end" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * الحالة الفارغة: أيقونة هادئة + جملة، وإجراء اختياري يقود إلى حيث يبدأ العمل.
 * children هو الوصف (توافقًا مع الاستعمال القديم)، وtitle اختياري فوقه.
 */
export function PanelEmpty({
  icon: Icon = InboxIcon,
  title,
  action,
  compact,
  children,
}: {
  icon?: LucideIcon;
  title?: string;
  action?: { href: string; label: string };
  /** ارتفاع أقل للوحات الجانبية. */
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 text-center", compact ? "py-6" : "py-9")}>
      <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
        <Icon className="size-4" />
      </span>
      {title ? <span className="text-sm font-semibold text-foreground">{title}</span> : null}
      <span className="max-w-xs text-xs leading-relaxed text-muted-foreground text-balance">{children}</span>
      {action ? (
        <Button asChild variant="outline" size="sm" className="mt-1">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
