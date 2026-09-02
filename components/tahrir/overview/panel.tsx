import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** لوحة نظرة اليوم: رأس رفيع بعنوان ورابط اختياري، والمحتوى صفوف بلا حشو إضافي. */
export function Panel({
  title,
  href,
  hrefLabel,
  aside,
  className,
  children,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <PanelHeader title={title} href={href} hrefLabel={hrefLabel} aside={aside} />
      {children}
    </Card>
  );
}

export function PanelHeader({
  title,
  href,
  hrefLabel,
  aside,
  className,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 border-b border-border/80 bg-muted/25 px-4 py-3", className)}>
      <h2 className="font-display text-[13.5px] font-bold text-foreground tracking-tight">{title}</h2>
      {href ? (
        <Link href={href} className="ms-auto inline-flex items-center gap-1 text-xs font-semibold text-(--t-sug) hover:underline">
          {hrefLabel ?? "الكل"}
          <ArrowLeftIcon className="size-3.5" />
        </Link>
      ) : aside ? (
        <span className="ms-auto text-[11px] text-muted-foreground">{aside}</span>
      ) : null}
    </div>
  );
}

export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center text-xs text-muted-foreground">{children}</div>;
}
