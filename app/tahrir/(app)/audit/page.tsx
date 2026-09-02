import Link from "next/link";
import { LockIcon } from "lucide-react";

import { StatusPill } from "@/components/tahrir/badges";
import { Card } from "@/components/ui/card";
import { listAudit } from "@/lib/tahrir/service";
import { cn } from "@/lib/utils";

export const metadata = { title: "سجل التدقيق" };
export const dynamic = "force-dynamic";

/** تصنيف الأفعال إلى مجموعات فلترة وألوان حالة. */
function actionMeta(action: string): { label: string; status: string; group: string } {
  if (action.startsWith("publish") || action === "status:published") return { label: "نشر", status: "published", group: "pub" };
  if (action === "status:review") return { label: "طلب اعتماد", status: "review", group: "rev" };
  if (action === "status:scheduled") return { label: "جدولة", status: "scheduled", group: "rev" };
  if (action === "schedule:blocked") return { label: "أوقفه الحارس", status: "archived", group: "blk" };
  if (action === "story:archive") return { label: "أرشفة", status: "archived", group: "blk" };
  if (action === "story:restore") return { label: "استعادة", status: "review", group: "rev" };
  if (action === "draft:delete") return { label: "حذف مسودة", status: "archived", group: "blk" };
  if (action.startsWith("media:")) return { label: "وسائط", status: "draft", group: "sav" };
  if (action.startsWith("series:")) return { label: "سلاسل", status: "scheduled", group: "rev" };
  if (action === "login") return { label: "دخول", status: "draft", group: "sav" };
  return { label: "حفظ", status: "draft", group: "sav" };
}

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Riyadh",
  }).format(new Date(iso));

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const rows = await listAudit(200).catch(() => []);

  const groups: Array<{ key?: string; label: string; count: number }> = [
    { key: undefined, label: "الكل", count: rows.length },
    { key: "pub", label: "نشر", count: 0 },
    { key: "rev", label: "اعتماد وجدولة", count: 0 },
    { key: "blk", label: "منع الحارس", count: 0 },
    { key: "sav", label: "حفظ ودخول", count: 0 },
  ];
  for (const row of rows) {
    const entry = groups.find((item) => item.key === actionMeta(row.action).group);
    if (entry) entry.count += 1;
  }
  const visible = f ? rows.filter((row) => actionMeta(row.action).group === f) : rows;

  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">سجل التدقيق</h1>
        <span className="text-xs text-muted-foreground">آخر 200 حدث — يُدوَّن من الخادم وغير قابل للتعديل</span>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
        {groups.map((group) => {
          const active = f === group.key || (!f && !group.key);
          return (
            <Link
              key={group.label}
              href={group.key ? `/tahrir/audit?f=${group.key}` : "/tahrir/audit"}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 font-display text-xs font-semibold whitespace-nowrap transition-colors",
                active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {group.label}
              <b className={cn("tabular-nums", active ? "text-primary" : "text-muted-foreground/80")}>{group.count}</b>
            </Link>
          );
        })}
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        {visible.length === 0 ? <div className="px-4 py-8 text-center text-xs text-muted-foreground">لا أحداث بهذا الفلتر.</div> : null}
        {visible.map((row) => {
          const meta = actionMeta(row.action);
          return (
            <div
              key={row.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-b px-4 py-2.5 last:border-0 sm:grid-cols-[112px_auto_minmax(0,1fr)_auto]"
            >
              <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">{timeOf(row.at)}</span>
              <StatusPill status={meta.status} label={meta.label} className="justify-self-start" />
              <span className="col-span-2 truncate text-xs sm:col-span-1">
                {row.storyId ? (
                  <Link href={`/tahrir/editor/${row.storyId}`} className="hover:underline">
                    {row.detail || row.storyId}
                  </Link>
                ) : (
                  row.detail || "—"
                )}
              </span>
              <span className="col-span-2 text-[11px] text-muted-foreground sm:col-span-1">{row.actor}</span>
            </div>
          );
        })}
        <p className="flex items-center gap-2 border-t bg-muted/40 px-4 py-2.5 text-[11px] text-muted-foreground">
          <LockIcon className="size-3.5" />
          السجل يُدوَّن آليًا من الخادم وغير قابل للتعديل أو الحذف — مرجع المساءلة التحريرية الوحيد.
        </p>
      </Card>
    </main>
  );
}
