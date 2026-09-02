"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PenLineIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { GuardChip, SeriesTag, StatusPill } from "@/components/tahrir/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useStoryActions } from "./story-actions";
import { countLabel, type StoryTableRow } from "./types";

const SELECTED_NOUN = { one: "مادة واحدة محددة", two: "مادتان محددتان", few: "مواد محددة", many: "مادة محددة" };

/** جدول المواد: تحديد جماعي بإجراءات على الشريط العلوي، وقائمة إجراءات لكل صف؛ الترقيم والتصفية من الخادم. */
export function StoriesTable({ rows, canArchive }: { rows: StoryTableRow[]; canArchive: boolean }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const { setAction, dialogs } = useStoryActions(() => setSelected(new Set()));

  const selectedRows = rows.filter((row) => selected.has(row.id));
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  const archivable = selectedRows.filter((row) => row.status !== "draft" && row.status !== "archived");
  const restorable = selectedRows.filter((row) => row.status === "archived");
  const drafts = selectedRows.filter((row) => row.status === "draft");

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {selectedRows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/60 px-3 py-2 text-xs">
          <span className="font-semibold tabular-nums">{countLabel(selectedRows.length, SELECTED_NOUN)}</span>
          {canArchive && archivable.length > 0 ? (
            <Button size="xs" variant="outline" onClick={() => setAction({ kind: "archive", rows: archivable })}>
              <ArchiveIcon data-icon="inline-start" />
              أرشفة ({archivable.length})
            </Button>
          ) : null}
          {canArchive && restorable.length > 0 ? (
            <Button size="xs" variant="outline" onClick={() => setAction({ kind: "restore", rows: restorable })}>
              <ArchiveRestoreIcon data-icon="inline-start" />
              استعادة كمسودة ({restorable.length})
            </Button>
          ) : null}
          {drafts.length > 0 ? (
            <Button size="xs" variant="outline" className="text-destructive" onClick={() => setAction({ kind: "delete", rows: drafts })}>
              <Trash2Icon data-icon="inline-start" />
              حذف المسودات ({drafts.length})
            </Button>
          ) : null}
          <Button size="xs" variant="ghost" className="ms-auto" onClick={() => setSelected(new Set())}>
            <XIcon data-icon="inline-start" />
            إلغاء التحديد
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 ps-3">
                <Checkbox
                  aria-label="تحديد كل مواد الصفحة"
                  checked={allSelected ? true : selectedRows.length > 0 ? "indeterminate" : false}
                  onCheckedChange={(checked) =>
                    setSelected(checked === true ? new Set(rows.map((row) => row.id)) : new Set())
                  }
                />
              </TableHead>
              <TableHead>المادة</TableHead>
              <TableHead className="hidden md:table-cell">السلسلة</TableHead>
              <TableHead className="hidden md:table-cell">الحارس</TableHead>
              <TableHead className="hidden md:table-cell">الحالة</TableHead>
              <TableHead className="hidden lg:table-cell">حُدّثت</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                  لا مواد بهذه المرشّحات.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => {
              const isSelected = selected.has(row.id);
              return (
                <TableRow key={row.id} data-state={isSelected ? "selected" : undefined}>
                  <TableCell className="ps-3">
                    <Checkbox
                      aria-label={`تحديد ${row.title}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => toggle(row.id, checked === true)}
                    />
                  </TableCell>
                  <TableCell className="relative max-w-[520px] ps-4 whitespace-normal md:whitespace-nowrap">
                    <i
                      aria-hidden
                      className="absolute inset-y-2.5 start-1 w-[3px] rounded-full"
                      style={{ background: row.series?.color ?? "var(--input)" }}
                    />
                    <Link href={row.href} className="block truncate text-[13px] font-semibold hover:underline">
                      {row.title}
                    </Link>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {row.isJak ? "▦ جاك العلم · " : ""}
                      {row.meta}
                    </span>
                    {/* على الجوال تنزل الشارات تحت العنوان بدل عمودين خارج الشاشة. */}
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
                      <StatusPill status={row.status} label={row.statusLabel} />
                      <GuardChip tone={row.guard.tone} label={row.guard.label} />
                      {row.series ? <SeriesTag name={row.series.name} color={row.series.color} /> : null}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {row.series ? <SeriesTag name={row.series.name} color={row.series.color} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <GuardChip tone={row.guard.tone} label={row.guard.label} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <StatusPill status={row.status} label={row.statusLabel} />
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground tabular-nums whitespace-nowrap lg:table-cell">
                    {row.updated}
                  </TableCell>
                  <TableCell className="pe-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-xs" variant="ghost" aria-label={`إجراءات ${row.title}`}>
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link href={row.href}>
                            <PenLineIcon />
                            فتح في المحرر
                          </Link>
                        </DropdownMenuItem>
                        {row.publicHref ? (
                          <DropdownMenuItem asChild>
                            <a href={row.publicHref} target="_blank" rel="noreferrer">
                              <ExternalLinkIcon />
                              عرض على الموقع
                            </a>
                          </DropdownMenuItem>
                        ) : null}
                        {(canArchive && row.status !== "draft") || row.status === "draft" ? <DropdownMenuSeparator /> : null}
                        {canArchive && row.status !== "draft" && row.status !== "archived" ? (
                          <DropdownMenuItem onSelect={() => setAction({ kind: "archive", rows: [row] })}>
                            <ArchiveIcon />
                            أرشفة
                          </DropdownMenuItem>
                        ) : null}
                        {canArchive && row.status === "archived" ? (
                          <DropdownMenuItem onSelect={() => setAction({ kind: "restore", rows: [row] })}>
                            <ArchiveRestoreIcon />
                            استعادة كمسودة
                          </DropdownMenuItem>
                        ) : null}
                        {row.status === "draft" ? (
                          <DropdownMenuItem variant="destructive" onSelect={() => setAction({ kind: "delete", rows: [row] })}>
                            <Trash2Icon />
                            حذف المسودة
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {dialogs}
    </Card>
  );
}
