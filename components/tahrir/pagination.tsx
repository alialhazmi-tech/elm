import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pageWindow } from "@/lib/tahrir/pagination";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  totalPages: number;
  /** رابط الصفحة المطلوبة — الشاشة تحتفظ ببقية الاستعلام (المرشّحات والبحث). */
  hrefFor: (page: number) => string;
  /** سطر «من–إلى من الإجمالي» يُعرض في بداية الصف. */
  summary?: React.ReactNode;
  ariaLabel?: string;
  /** تسميتا الطرفين: الأحدث/الأقدم للقوائم الزمنية، السابق/التالي لغيرها. */
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
}

/**
 * ترقيم موحّد للشاشات (المواد، الوسائط، …): السابق/التالي + نافذة أرقام بأرقام لاتينية،
 * الأسهم تنقلب مع الاتجاه، والطرف المعطّل زر معطّل لا رابط بلا مؤشر.
 */
export function Pagination({
  page,
  totalPages,
  hrefFor,
  summary,
  ariaLabel = "ترقيم الصفحات",
  previousLabel = "الأحدث",
  nextLabel = "الأقدم",
  className,
}: PaginationProps) {
  const last = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), last);
  const numbers = pageWindow(current, last);

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground", className)}>
      {summary ? <span className="tabular-nums">{summary}</span> : null}
      {last > 1 ? (
        <nav aria-label={ariaLabel} className="ms-auto flex flex-wrap items-center gap-1">
          <EdgeButton disabled={current <= 1} href={hrefFor(current - 1)} ariaLabel="الصفحة السابقة">
            <ChevronLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
            {previousLabel}
          </EdgeButton>
          {numbers.map((number, index) => (
            <span key={number} className="contents">
              {index > 0 && numbers[index - 1] !== number - 1 ? (
                <span aria-hidden className="px-1">
                  …
                </span>
              ) : null}
              {number === current ? (
                <Button size="sm" variant="default" aria-current="page" aria-label={`الصفحة ${number} — الحالية`} className="min-w-8 tabular-nums">
                  {number}
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline" className="min-w-8 tabular-nums">
                  <Link href={hrefFor(number)} aria-label={`الصفحة ${number}`}>
                    {number}
                  </Link>
                </Button>
              )}
            </span>
          ))}
          <EdgeButton disabled={current >= last} href={hrefFor(current + 1)} ariaLabel="الصفحة التالية">
            {nextLabel}
            <ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
          </EdgeButton>
        </nav>
      ) : null}
    </div>
  );
}

function EdgeButton({
  disabled,
  href,
  ariaLabel,
  children,
}: {
  disabled: boolean;
  href: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button size="sm" variant="outline" disabled aria-label={ariaLabel}>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href} aria-label={ariaLabel}>
        {children}
      </Link>
    </Button>
  );
}
