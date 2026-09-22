"use client";
import { useEffect, useState } from "react";
import { HistoryIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { stripHtmlToText } from "@/lib/content/html";
import { formatRiyadhDateTime } from "@/lib/format";
import type { FieldChange } from "@/lib/tahrir/story-audit";

type TimelineEvent = { id: string; at: string; actorName: string; action: string; label: string; tone: string; storyId: string; isRevision: boolean; detail: string; recordedDetails: boolean; fields: string[]; changes?: FieldChange[]; references?: Record<string, string> };
type TimelinePage = { title: string; events: TimelineEvent[]; nextCursor: string | null };
const date = (value: string) => formatRiyadhDateTime(value, { seconds: true }) || "وقت غير معروف";

export function StoryTimeline({ id, compact = false, storyTitle }: { id: string | null; compact?: boolean; storyTitle?: string }) {
  const [open, setOpen] = useState(false);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild><Button size={compact ? "icon-xs" : "sm"} variant={compact ? "ghost" : "outline"} className={compact ? "size-9 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:size-6" : undefined} disabled={!id} title={id ? "السجل الزمني" : "احفظ المسودة لبدء سجلها"} aria-label={storyTitle ? `السجل الزمني: ${storyTitle}` : "السجل الزمني"}><HistoryIcon className={compact ? "size-3.5" : undefined} />{!compact && "السجل الزمني"}</Button></SheetTrigger>
    <SheetContent side="left" className="data-[side=left]:w-full data-[side=left]:sm:max-w-xl">
      <SheetHeader className="border-b pe-12"><SheetTitle>السجل الزمني للمادة</SheetTitle><SheetDescription>كل حدث محفوظ باسمه وتاريخه ومنفّذه. الأوقات بتوقيت الرياض.</SheetDescription></SheetHeader>
      {open && id && <TimelineContent key={id} id={id} />}
    </SheetContent>
  </Sheet>;
}

function TimelineContent({ id }: { id: string }) {
  const [page, setPage] = useState<TimelinePage | null>(null);
  const [request, setRequest] = useState({ cursor: "", revision: 0 });
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/tahrir/story/${id}/timeline${request.cursor ? `?cursor=${encodeURIComponent(request.cursor)}` : ""}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(async res => { const result = await res.json(); if (!res.ok) throw new Error(result.error ?? "تعذر تحميل السجل."); if (!controller.signal.aborted) setPage(current => request.cursor && current ? { ...result, events: [...current.events, ...result.events.filter((event: TimelineEvent) => !current.events.some(existing => existing.id === event.id))] } : result); })
      .catch(error => { if (!controller.signal.aborted) setError(error.name === "TimeoutError" ? "تأخر تحميل السجل. أعد المحاولة." : error.message); })
      .finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [id, request]);
  function load(cursor = "") { setPending(true); setError(""); setRequest(current => ({ cursor, revision: current.revision + 1 })); }
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
    <div className="mb-5 flex items-start justify-between gap-3"><p className="min-w-0 text-sm font-semibold leading-7">{page?.title ?? "جارٍ تحميل المادة…"}</p><Button size="sm" variant="ghost" disabled={pending} onClick={() => load()}><RefreshCwIcon />تحديث</Button></div>
    {error && <div role="alert" className="mb-4 space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="sm" onClick={() => load(request.cursor)}>إعادة المحاولة</Button></div>}
    <ol aria-label="أحداث المادة من الأحدث إلى الأقدم" className="ms-2 border-s border-border">
      {page?.events.map(event => <li key={event.id} className="relative pb-6 ps-6 last:pb-0">
        <span aria-hidden="true" className={`absolute -start-[5px] top-2 size-2.5 rounded-full ring-4 ring-background ${event.tone === "danger" ? "bg-(--t-block)" : event.tone === "success" ? "bg-(--t-ok)" : event.tone === "warning" ? "bg-(--t-warn)" : "bg-primary"}`} />
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{event.label}</h3>{event.isRevision && <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">مسودة تعديل</span>}</div>
        <p className="mt-1 text-sm">{event.actorName}</p><time dateTime={event.at} className="mt-1 block text-xs text-muted-foreground">{date(event.at)}</time>
        {event.detail && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{event.detail}</p>}
        {!!event.fields.length && <><p className="mt-2 text-xs leading-6 text-muted-foreground">التغييرات: {event.fields.join("، ")}</p><EventChanges storyId={id} event={event} /></>}
        {event.recordedDetails && !event.fields.length && event.action === "draft:save" && <p className="mt-2 text-xs text-muted-foreground">حفظ دون تغيير في المحتوى.</p>}
      </li>)}
    </ol>
    {pending && <p role="status" className="py-4 text-center text-sm text-muted-foreground">جارٍ تحميل الأحداث…</p>}
    {!pending && page && !page.events.length && <p className="py-8 text-center text-sm text-muted-foreground">لا توجد أحداث مسجلة لهذه المادة بعد.</p>}
    {page?.nextCursor && <Button variant="outline" className="mt-6 w-full" disabled={pending} onClick={() => load(page.nextCursor!)}>تحميل أحداث أقدم</Button>}
    <p className="mt-6 border-t pt-4 text-xs leading-6 text-muted-foreground">يعرض السجل العمليات المحفوظة على الخادم. الأحداث القديمة تظهر بالتفاصيل التي سُجلت وقتها؛ التغييرات غير المحفوظة لا تظهر هنا.</p>
  </div>;
}

function EventChanges({ storyId, event }: { storyId: string; event: TimelineEvent }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<TimelineEvent | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open || result) return;
    const controller = new AbortController();
    void fetch(`/api/tahrir/story/${storyId}/timeline?eventId=${encodeURIComponent(event.id)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error ?? "تعذر تحميل التفاصيل."); if (!controller.signal.aborted) setResult(data.events[0]); })
      .catch(() => { if (!controller.signal.aborted) setError("تعذر تحميل التفاصيل. أغلقها وافتحها للمحاولة."); });
    return () => controller.abort();
  }, [open, result, storyId, event.id]);
  return <div className="mt-2"><Button size="sm" variant="ghost" className="px-0" aria-expanded={open} onClick={() => { setError(""); setOpen(!open); }}>{open ? "إخفاء التغييرات" : "عرض التغييرات قبل وبعد"}</Button>
    {open && <div className="mt-2 space-y-3">{error ? <p role="alert" className="text-xs text-destructive">{error}</p> : !result ? <p role="status" className="text-xs">جارٍ تحميل التفاصيل…</p> : result.changes?.map(change => <div key={change.field} className="rounded-lg border p-3 text-sm"><h4 className="mb-2 font-semibold">{change.label}</h4>
      <div className="space-y-2"><div className="rounded bg-muted/60 p-2"><p className="mb-1 text-xs font-semibold text-muted-foreground">{change.text ? "النص المستبدل" : "قبل"}</p><p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words leading-7">{changeValue(change.text ? change.text.removed : change.before, change.field, result.references)}</p></div>
      <div className="rounded border border-(--t-ok)/20 bg-(--t-ok-bg) p-2"><p className="mb-1 text-xs font-semibold text-(--t-ok)">{change.text ? "النص الجديد" : "بعد"}</p><p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words leading-7">{changeValue(change.text ? change.text.added : change.after, change.field, result.references)}</p></div></div>
    </div>)}</div>}
  </div>;
}

function changeValue(value: unknown, field: string, references: Record<string, string> = {}): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "pinned") return value ? "مثبتة" : "غير مثبتة";
  if (field === "status") return ({ draft: "مسودة", review: "بانتظار الاعتماد", scheduled: "مجدولة", published: "منشورة", archived: "مؤرشفة" })[String(value)] ?? String(value);
  if (["scheduledAt", "dueAt", "publishedAt", "returnedAt", "breakingUntil", "boostedAt"].includes(field) && typeof value === "string" && Number.isFinite(Date.parse(value))) return `${date(value)} (الرياض)`;
  if (typeof value === "string") return references[value] ?? (field === "body" ? stripHtmlToText(value) || "تغيير في تنسيق المتن" : value);
  return Array.isArray(value) && value.every(item => typeof item === "string") ? value.join("، ") : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}
