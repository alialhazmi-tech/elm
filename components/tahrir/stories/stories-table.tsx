"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ExternalLinkIcon,
  PenLineIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { GuardChip, SeriesTag, StatusPill } from "@/components/tahrir/badges";
import { StoryTimeline } from "@/components/tahrir/story-timeline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useStoryActions } from "./story-actions";
import { countLabel, type StoryTableRow } from "./types";

const SELECTED_NOUN = { one: "مادة واحدة محددة", two: "مادتان محددتان", few: "مواد محددة", many: "مادة محددة" };

/** جدول المواد: تحديد جماعي، وإجراءات صفية ظاهرة بالترتيب نفسه لجدول الأعضاء؛ الترقيم والتصفية من الخادم. */
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
            <TableRow className="border-b border-border/80 bg-muted/20 hover:bg-muted/20">
              <TableHead className="w-10 ps-3">
                <Checkbox
                  aria-label="تحديد كل مواد الصفحة"
                  checked={allSelected ? true : selectedRows.length > 0 ? "indeterminate" : false}
                  onCheckedChange={(checked) =>
                    setSelected(checked === true ? new Set(rows.map((row) => row.id)) : new Set())
                  }
                />
              </TableHead>
              <TableHead className="font-display text-xs font-semibold">المادة</TableHead>
              <TableHead className="hidden w-32 font-display text-xs font-semibold md:table-cell">السلسلة</TableHead>
              <TableHead className="hidden w-28 font-display text-xs font-semibold md:table-cell">الحارس</TableHead>
              <TableHead className="hidden w-28 font-display text-xs font-semibold md:table-cell">الحالة</TableHead>
              <TableHead className="hidden w-28 font-display text-xs font-semibold lg:table-cell">حُدّثت</TableHead>
              <TableHead className="w-32 pe-4 font-display text-xs font-semibold text-start">الإجراءات</TableHead>
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
                <TableRow key={row.id} data-state={isSelected ? "selected" : undefined} className="transition-colors hover:bg-muted/30">
                  <TableCell className="ps-3 py-2.5">
                    <Checkbox
                      aria-label={`تحديد ${row.title}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => toggle(row.id, checked === true)}
                    />
                  </TableCell>
                  <TableCell className="relative max-w-[520px] ps-4 py-2.5 whitespace-normal md:whitespace-nowrap">
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
                  <TableCell className="hidden w-32 py-2.5 md:table-cell">
                    {row.series ? <SeriesTag name={row.series.name} color={row.series.color} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden w-28 py-2.5 md:table-cell">
                    <GuardChip tone={row.guard.tone} label={row.guard.label} />
                  </TableCell>
                  <TableCell className="hidden w-28 py-2.5 md:table-cell">
                    <StatusPill status={row.status} label={row.statusLabel} />
                  </TableCell>
                  <TableCell className="hidden w-28 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap lg:table-cell">
                    {row.updated}
                  </TableCell>
                  <TableCell className="w-32 pe-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <Button
                        asChild
                        size="icon-xs"
                        variant="ghost"
                        className="text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="فتح في المحرر"
                      >
                        <Link href={row.href} aria-label={`فتح ${row.title} في المحرر`}>
                          <PenLineIcon className="size-3.5" />
                        </Link>
                      </Button>
                      <StoryTimeline id={row.id} storyTitle={row.title} compact />
                      {row.publicHref ? (
                        <Button
                          asChild
                          size="icon-xs"
                          variant="ghost"
                          className="text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="عرض على الموقع"
                        >
                          <a href={row.publicHref} target="_blank" rel="noreferrer" aria-label={`عرض ${row.title} على الموقع`}>
                            <ExternalLinkIcon className="size-3.5" />
                          </a>
                        </Button>
                      ) : null}
                      {canArchive && row.status !== "draft" && row.status !== "archived" ? (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          className="text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="أرشفة"
                          aria-label={`أرشفة ${row.title}`}
                          onClick={() => setAction({ kind: "archive", rows: [row] })}
                        >
                          <ArchiveIcon className="size-3.5" />
                        </Button>
                      ) : null}
                      {canArchive && row.status === "archived" ? (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          className="text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="استعادة كمسودة"
                          aria-label={`استعادة ${row.title} كمسودة`}
                          onClick={() => setAction({ kind: "restore", rows: [row] })}
                        >
                          <ArchiveRestoreIcon className="size-3.5" />
                        </Button>
                      ) : null}
                      {row.status === "draft" ? (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          className="text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="حذف المسودة"
                          aria-label={`حذف مسودة ${row.title}`}
                          onClick={() => setAction({ kind: "delete", rows: [row] })}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
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
