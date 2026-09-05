"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  LockKeyhole,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditEntry } from "@/lib/tahrir/audit-data";
import {
  AUDIT_GROUPS,
  auditMeta,
  auditPermissionDetails,
  auditSummary,
  type AuditTone,
} from "@/lib/tahrir/audit-presentation";
const tones: Record<AuditTone, string> = {
  normal: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  danger: "bg-red-500/10 text-red-700 dark:text-red-300",
};
const date = (iso: string, timeOnly = false) => {
  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) return "وقت غير معروف";
  return new Intl.DateTimeFormat(
    "ar-SA-u-ca-gregory-nu-latn",
    timeOnly
      ? {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "Asia/Riyadh",
        }
      : {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Riyadh",
        },
  ).format(value);
};
export function AuditBrowser({
  rows,
  loadedAt,
}: {
  rows: AuditEntry[];
  loadedAt: number;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [actor, setActor] = useState("all");
  const [period, setPeriod] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const actors = useMemo(
    () =>
      [
        ...new Map(
          rows.map((row) => [row.actor, row.actorName || row.actor]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1], "ar")),
    [rows],
  );
  const visible = useMemo(
    () =>
      rows.filter((row) => {
        const meta = auditMeta(row.action);
        const haystack = [
          row.actor,
          row.actorName,
          row.action,
          meta.label,
          row.detail,
          row.storyId,
          row.storyTitle,
          auditSummary(row),
          ...auditPermissionDetails(row.action, row.detail).map((p) => p.label),
        ]
          .join(" ")
          .toLocaleLowerCase("ar");
        return (
          (group === "all" || meta.group === group) &&
          (actor === "all" || row.actor === actor) &&
          (period === "all" ||
            new Date(row.at).getTime() >=
              loadedAt - Number(period) * 86400000) &&
          (!q.trim() || haystack.includes(q.trim().toLocaleLowerCase("ar")))
        );
      }),
    [rows, q, group, actor, period, loadedAt],
  );
  const pages = Math.max(1, Math.ceil(visible.length / 25));
  const current = Math.min(page, pages);
  const slice = visible.slice((current - 1) * 25, current * 25);
  const hasFilters =
    !!q || group !== "all" || actor !== "all" || period !== "all";
  const permissions = selected
    ? auditPermissionDetails(selected.action, selected.detail)
    : [];
  const reset = () => {
    setQ("");
    setGroup("all");
    setActor("all");
    setPeriod("all");
    setPage(1);
  };
  return (
    <>
      <section
        className="rounded-xl border bg-card p-4"
        aria-label="بحث وتصفية السجل"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr]">
          <div className="grid gap-2">
            <Label htmlFor="audit-search">البحث في السجل</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="audit-search"
                className="ps-9"
                placeholder="اسم، مادة، إجراء أو تفاصيل…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="audit-group">نوع الإجراء</Label>
            <select
              id="audit-group"
              className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm"
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">كل الإجراءات</option>
              {AUDIT_GROUPS.filter((g) =>
                rows.some((r) => auditMeta(r.action).group === g.id),
              ).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="audit-actor">المنفّذ</Label>
            <select
              id="audit-actor"
              className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm"
              value={actor}
              onChange={(e) => {
                setActor(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">كل المنفّذين</option>
              {actors.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="audit-period">الفترة</Label>
            <select
              id="audit-period"
              className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">كل الفترة المحمّلة</option>
              <option value="1">آخر 24 ساعة</option>
              <option value="7">آخر 7 أيام</option>
              <option value="30">آخر 30 يومًا</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            البحث والتصفية ضمن آخر {rows.length} حدثًا محمّلًا، بحد أقصى 200
            حدث.
          </span>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <X />
              مسح الفلاتر
            </Button>
          )}
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold">
          {visible.length} حدث
          {hasFilters ? " يطابق الفلاتر" : " في السجل المحمّل"}
        </span>
        <span className="text-xs text-muted-foreground">
          الأحدث أولًا · التوقيت المحلي للسعودية
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table className="min-w-[780px] table-fixed">
          <TableHeader className="bg-muted/30">
            <TableRow>
              {["الوقت", "المنفّذ", "الإجراء", "الملخص", "التفاصيل"].map(
                (label, i) => (
                  <TableHead
                    key={label}
                    style={{ width: ["16%", "18%", "24%", "32%", "10%"][i] }}
                    className="font-display text-xs font-semibold"
                  >
                    {label}
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!slice.length && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-14 text-center text-muted-foreground"
                >
                  {rows.length
                    ? "لا توجد أحداث تطابق البحث. جرّب تغيير الفلاتر."
                    : "لم تُسجّل أحداث بعد."}
                </TableCell>
              </TableRow>
            )}
            {slice.map((row) => {
              const meta = auditMeta(row.action);
              return (
                <TableRow key={row.id} className="hover:bg-muted/20">
                  <TableCell className="py-3">
                    <time dateTime={row.at} className="grid gap-1 text-xs">
                      <span className="font-medium tabular-nums" dir="ltr">
                        {date(row.at, true)}
                      </span>
                      <span className="text-muted-foreground">
                        {date(row.at)}
                      </span>
                    </time>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <ProfileAvatar name={row.actorName || row.actor} image={row.actorAvatarUrl} size={32} />
                      <div className="grid min-w-0 gap-1">
                        <span
                          className="truncate text-sm font-semibold"
                          title={row.actorName || row.actor}
                        >
                          {row.actorName || row.actor}
                        </span>
                        {row.actorName && (
                          <span
                            className="truncate text-xs text-muted-foreground"
                            dir="auto"
                          >
                            {row.actor}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex max-w-full rounded-md px-2 py-1 text-xs font-semibold whitespace-normal ${tones[meta.tone]}`}
                    >
                      {meta.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="line-clamp-2 text-sm leading-6 whitespace-normal break-words">
                      {auditSummary(row)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`تفاصيل ${meta.label} في ${date(row.at, true)}`}
                      title="عرض تفاصيل الحدث"
                      onClick={() => setSelected(row)}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/10 px-4 py-3 text-xs">
          <span className="text-muted-foreground">
            {visible.length
              ? `${(current - 1) * 25 + 1}–${Math.min(current * 25, visible.length)} من ${visible.length}`
              : "لا نتائج"}
          </span>
          <nav
            aria-label="صفحات سجل التدقيق"
            className="flex items-center gap-2"
          >
            <Button
              size="sm"
              variant="outline"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronRight />
              السابق
            </Button>
            <span className="px-1 tabular-nums">
              {current} / {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              التالي
              <ChevronLeft />
            </Button>
          </nav>
        </div>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <LockKeyhole className="size-4 shrink-0" />
        عرض للقراءة فقط. النص الأصلي لكل حدث محفوظ في تفاصيله.
      </p>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent
          side="left"
          className="overflow-y-auto data-[side=left]:w-full data-[side=left]:sm:max-w-xl"
        >
          <SheetHeader>
            <SheetTitle>
              {selected ? auditMeta(selected.action).label : "تفاصيل الحدث"}
            </SheetTitle>
            <SheetDescription>
              بيانات الحدث كما سُجّلت، مع شرح مقروء للصلاحيات عند توفره.
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="grid gap-6 px-6 pb-8">
              <dl className="grid grid-cols-2 gap-5 text-sm">
                <div>
                  <dt className="text-muted-foreground">المنفّذ</dt>
                  <dd className="mt-2 flex items-center gap-2 break-words font-semibold">
                    <ProfileAvatar name={selected.actorName || selected.actor} image={selected.actorAvatarUrl} size={36} />
                    {selected.actorName || selected.actor}
                  </dd>
                  <dd className="mt-1 text-xs text-muted-foreground" dir="auto">
                    {selected.actor}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">وقت الحدث</dt>
                  <dd className="mt-1">{date(selected.at)}</dd>
                  <dd className="mt-1 tabular-nums">
                    {date(selected.at, true)} · الرياض
                  </dd>
                </div>
              </dl>
              <p className="rounded-lg bg-muted/30 p-3 text-sm font-semibold leading-7 break-words">
                {auditSummary(selected)}
              </p>
              {selected.storyId && (
                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-xs text-muted-foreground">
                    المادة المرتبطة
                  </p>
                  <Link
                    href={`/tahrir/editor/${encodeURIComponent(selected.storyId)}`}
                    className="text-sm font-semibold underline underline-offset-4"
                  >
                    {selected.storyTitle || "فتح المادة المرتبطة"}
                  </Link>
                </div>
              )}
              {permissions.length > 0 && (
                <section>
                  <h3 className="mb-3 font-display text-sm font-bold">
                    الصلاحيات الواردة في الحدث
                  </h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    القائمة تصف ما ورد في هذا الحدث، ولا تمثّل بالضرورة
                    الصلاحيات الحالية.
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {permissions.map((p, i) => (
                      <li
                        key={`${p.key}-${i}`}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 text-xs ${p.effect === "allow" ? tones.success : tones.danger}`}
                        >
                          {p.effect === "allow" ? "سماح" : "منع"}
                        </span>
                        <span className="break-words">{p.label}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {!permissions.length && (
                <section>
                  <h3 className="mb-2 font-display text-sm font-bold">
                    التفاصيل
                  </h3>
                  <p className="text-sm leading-7 whitespace-pre-wrap break-words">
                    {selected.detail || "لا توجد تفاصيل إضافية لهذا الحدث."}
                  </p>
                </section>
              )}
              <details className="rounded-lg border bg-muted/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  البيانات الأصلية للحدث
                </summary>
                <dl className="mt-4 grid gap-4 text-xs">
                  {[
                    ["معرّف الحدث", selected.id],
                    ["رمز الإجراء", selected.action],
                    ["هوية المنفّذ المسجّلة", selected.actor],
                    ["وقت الخادم", selected.at],
                    ["معرّف المادة", selected.storyId || "—"],
                    ["النص الأصلي", selected.detail || "—"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="mb-1 text-muted-foreground">{label}</dt>
                      <dd
                        dir="auto"
                        className="leading-6 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
              <p className="text-xs leading-6 text-muted-foreground">
                الأسماء وعناوين المواد تُعرض بقيمها الحالية للتوضيح؛ هوية
                المنفّذ والنص الأصلي في السجل لا يتغيران.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
