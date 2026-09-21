import { cn } from "@/lib/utils";

/**
 * رأس الشاشة الموحّد للوحة: عنوان بارز، سطر وصف هادئ، وإجراءات في نهاية السطر.
 * على الجوال تنزل الإجراءات تحت العنوان بعرض كامل فلا تُزاحمه.
 */
export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="grid min-w-0 gap-1">
        <h1 className="font-display text-[22px] leading-tight font-extrabold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description ? <p className="text-[13px] leading-snug text-muted-foreground sm:text-sm">{description}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
