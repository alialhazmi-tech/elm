import Link from "next/link";
import { ArrowLeftIcon, FileCode2Icon, PlusIcon } from "lucide-react";

import type { JakCodeReport } from "@/lib/jak-report-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PanelEmpty } from "@/components/tahrir/overview/panel";

const STATUS: Record<JakCodeReport["status"], { label: string; variant: "secondary" | "warning" | "success" | "outline" }> = {
  draft: { label: "مسودة", variant: "secondary" },
  review: { label: "بانتظار المراجعة", variant: "warning" },
  published: { label: "منشور", variant: "success" },
  archived: { label: "مؤرشف", variant: "outline" },
};

const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "—"
    : new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", year: "numeric" }).format(date);
};

export function JakReportList({ reports }: { reports: JakCodeReport[] }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold text-primary">مختبر التقارير المرئية</p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">جاك العلم</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            تقارير HTML/CSS قابلة للعرض على الويب، بصيغة تحرير سريعة تشبه صفحات جاك القديمة.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/tahrir/jak-reports/preview">معاينة القسم</Link>
          </Button>
          <Button asChild>
            <Link href="/tahrir/jak-reports/new">
              <PlusIcon data-icon="inline-start" />
              تقرير جديد
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-y border-border/70 py-2 text-xs text-muted-foreground">
        <FileCode2Icon className="size-4" aria-hidden />
        <span>{reports.length} تقريرًا في مساحة التحرير</span>
        <span className="ms-auto">تظهر التقارير للجمهور بعد نشرها</span>
      </div>

      {reports.length === 0 ? (
        <Card>
          <PanelEmpty action={{ href: "/tahrir/jak-reports/new", label: "أنشئ أول تقرير" }}>
            لا توجد تقارير HTML محفوظة بعد. ابدأ بلصق قالب جاك القديم أو اكتب تقريرًا جديدًا.
          </PanelEmpty>
        </Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {reports.map((report) => {
            const status = STATUS[report.status];
            return (
              <Link
                key={report.id}
                href={`/tahrir/jak-reports/${report.id}`}
                className="group grid gap-3 rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex items-start gap-3">
                  <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                    {report.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={report.image} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <FileCode2Icon className="size-5" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-display text-sm font-bold">{report.title || "بلا عنوان"}</h2>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {report.excerpt || "لا توجد نبذة لهذا التقرير."}
                    </p>
                  </div>
                  <ArrowLeftIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1" aria-hidden />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                  <span>آخر تحديث: {dateLabel(report.updatedAt)}</span>
                  {report.showOnHomepage ? <span className="text-primary">محدد للظهور في القسم بعد النشر</span> : null}
                  {report.sourceUrl ? <span className="truncate" dir="ltr">مصدر مستورد</span> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
