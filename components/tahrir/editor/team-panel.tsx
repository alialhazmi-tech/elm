"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CircleCheckIcon } from "lucide-react";
import { toast } from "sonner";

type Team = { notes: Array<{ id: string; authorName: string; body: string; kind: string; createdAt: string }>; editors: Array<{ id: string; name: string }>; assignedTo: string | null; assigneeName: string | null; dueAt: string | null; returnedAt: string | null; canAssign: boolean; canReturn: boolean };
const localDate = (iso: string | null) => iso ? new Date(Date.parse(iso) - new Date(iso).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";
export function TeamPanel({ id, status, locked, dirty, getVersion, onVersion, onReturn }: { id: string | null; status: string; locked: boolean; dirty: boolean; getVersion: () => number; onVersion: (version: number) => void; onReturn: () => void }) {
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Team | null>(null);
  const [body, setBody] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingAssignment, setEditingAssignment] = useState(false);
  const actionLock = useRef(false);
  const endpoint = `/api/tahrir/story/${id}/team`;
  useEffect(() => {
    if (!open || !id) return;
    const controller = new AbortController();
    void fetch(endpoint, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]), cache: "no-store" }).then(async res => {
      const result = await res.json(); if (!res.ok) throw new Error(result.error ?? "تعذر تحميل المراجعة.");
      setData(result); setAssignedTo(result.assignedTo ?? ""); setDueAt(localDate(result.dueAt)); setEditingAssignment(!result.assignedTo); setError("");
    }).catch(error => { if (!controller.signal.aborted) setError(error.name === "TimeoutError" ? "تأخر تحميل المراجعة. أغلق القسم وافتحه للمحاولة." : error.message); });
    return () => controller.abort();
  }, [open, id, endpoint, status, refresh]);
  async function act(action: "assign" | "comment" | "return") {
    if (actionLock.current || locked || !id || (action === "return" && dirty)) return;
    actionLock.current = true; setPending(true); setError(""); setNotice("");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000), body: JSON.stringify({ action, body, assignedTo: assignedTo || null, dueAt: dueAt ? new Date(dueAt).toISOString() : null, expectedVersion: getVersion() }) });
      const result = await res.json(); if (!res.ok) throw new Error(result.error ?? "تعذر تنفيذ الإجراء.");
      if (action !== "comment") onVersion(result.version);
      if (action === "return") { onReturn(); return; }
      if (action === "assign") {
        setData(current => current ? { ...current, ...result.assignment } : current);
        setAssignedTo(result.assignment.assignedTo ?? ""); setDueAt(localDate(result.assignment.dueAt));
        setEditingAssignment(false);
        const message = result.assignment.assignedTo ? `تم إسناد المادة إلى ${result.assignment.assigneeName} بنجاح.` : "تم إلغاء إسناد المادة.";
        setNotice(message); toast.success(message);
        return;
      }
      setBody(""); setNotice("أُضيفت الملاحظة.");
      const refreshed = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (refreshed.ok) setData(await refreshed.json());
    } catch (error) { setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "انتهت مهلة الاتصال. أغلق القسم وافتحه للتحقق من النتيجة قبل إعادة الإجراء."); }
    finally { actionLock.current = false; setPending(false); }
  }
  return <section className="rounded-xl border bg-card" data-tour="team">
    <button type="button" className="flex w-full items-center justify-between p-4 text-start font-semibold" aria-expanded={open} onClick={() => setOpen(!open)}>الإسناد وملاحظات المراجعة <span className="text-muted-foreground">{open ? "−" : "+"}</span></button>
    {open && <div className="space-y-4 border-t p-4">
      {!id ? <p className="text-sm text-muted-foreground">احفظ المسودة أولًا لتتمكن من إسنادها ومشاركة الملاحظات.</p> : <>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {notice && <p role="status" className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CircleCheckIcon className="size-4 shrink-0" aria-hidden="true" />{notice}</p>}
        {!data && !error && <p role="status">جارٍ تحميل المراجعة…</p>}
        {data && <>
          {data.returnedAt && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">أُعيدت هذه المادة للتعديل. راجع السبب أدناه ثم أرسلها للاعتماد بعد المعالجة.</p>}
          {data.canAssign && editingAssignment ? <div className="space-y-3">
            <div className="grid items-end gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">المحرر المسؤول<select className="h-9 rounded-md border bg-background px-2" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} disabled={pending || locked}><option value="">دون إسناد</option>{data.editors.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
            <label htmlFor="assignment-due" className="grid gap-2 text-sm">موعد التسليم (بتوقيت جهازك)<Input id="assignment-due" type="datetime-local" dir="ltr" value={dueAt} onChange={e => setDueAt(e.target.value)} disabled={pending || locked} /></label>
            </div>
            <div className="flex gap-2"><Button onClick={() => void act("assign")} disabled={pending || locked}>{pending ? "جارٍ حفظ الإسناد…" : "حفظ الإسناد"}</Button><Button variant="ghost" disabled={pending} onClick={() => { setAssignedTo(data.assignedTo ?? ""); setDueAt(localDate(data.dueAt)); setEditingAssignment(false); }}>إلغاء</Button></div>
          </div> : <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
            <div className="min-w-0 space-y-1 text-sm"><p className="font-semibold">{data.assignedTo ? `مسندة إلى ${data.assigneeName ?? "محرر غير متاح"}` : "المادة غير مسندة"}</p><p className="text-muted-foreground">{data.dueAt ? `التسليم: ${new Date(data.dueAt).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" })} (الرياض)` : "لم يُحدّد موعد تسليم"}</p></div>
            {data.canAssign && <Button size="sm" variant="outline" disabled={pending || locked} onClick={() => { setNotice(""); setEditingAssignment(true); }}>{data.assignedTo ? "تعديل الإسناد" : "إسناد المادة"}</Button>}
          </div>}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRefresh(value => value + 1)}>تحديث الملاحظات</Button>
          <div className="max-h-72 space-y-3 overflow-y-auto" aria-label="آخر ملاحظات المراجعة">
            {!data.notes.length && <p className="text-sm text-muted-foreground">لا توجد ملاحظات بعد. يمكنك إضافة المصادر وروابط التحقق هنا أيضًا.</p>}
            {data.notes.map(note => <article key={note.id} className="rounded-lg border p-3 text-sm"><p className="mb-1 font-semibold">{note.authorName}{note.kind === "return" ? " · سبب الإعادة للتعديل" : ""}</p><p className="whitespace-pre-wrap break-words">{note.body}</p><time className="mt-2 block text-xs text-muted-foreground" dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString("ar-SA-u-ca-gregory-nu-latn")}</time></article>)}
          </div>
          <label htmlFor="editorial-note" className="grid gap-2 text-sm">ملاحظة أو سبب الإعادة<Textarea id="editorial-note" value={body} onChange={e => setBody(e.target.value)} maxLength={4000} rows={3} placeholder="حدّد التعديل المطلوب وأضف روابط المصادر عند الحاجة…" disabled={pending} /></label>
          <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => void act("comment")} disabled={!body.trim() || pending || locked}>إضافة ملاحظة</Button>
            {data.canReturn && <Button onClick={() => void act("return")} disabled={body.trim().length < 8 || dirty || pending || locked}>إعادة للمحرر مع السبب</Button>}
            {data.canReturn && dirty && <span className="text-xs text-muted-foreground">راجع التعديلات غير المحفوظة قبل الإعادة.</span>}
            <span className="text-xs text-muted-foreground">الملاحظات داخلية؛ لا تظهر للقراء. آخر 50 ملاحظة.</span>
          </div>
        </>}
      </>}
    </div>}
  </section>;
}

export function EditorPresence({ id }: { id: string | null }) {
  const [editors, setEditors] = useState<Array<{ userId: string; name: string }>>([]);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!id) return;
    let stopped = false, pending = false;
    const sessionId = crypto.randomUUID();
    const controller = new AbortController();
    async function heartbeat() {
      if (pending || stopped || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const res = await fetch(`/api/tahrir/story/${id}/presence`, { method: "POST", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
        if (!res.ok) throw new Error();
        const result = await res.json();
        if (!stopped) { setEditors(result.editors); setUnavailable(false); }
      } catch { if (!stopped) { setUnavailable(true); setEditors([]); } }
      finally { pending = false; }
    }
    function leave() {
      void fetch(`/api/tahrir/story/${id}/presence`, { method: "DELETE", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) }).catch(() => {});
    }
    window.addEventListener("pagehide", leave);
    void heartbeat(); const timer = window.setInterval(() => void heartbeat(), 30_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => { stopped = true; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", heartbeat); window.removeEventListener("pagehide", leave); leave(); };
  }, [id]);
  if (!id) return null;
  if (unavailable) return <p role="status" className="text-xs text-muted-foreground">تعذر التحقق من وجود محررين آخرين. حماية تعارض النسخ ما زالت مفعّلة.</p>;
  if (!editors.length) return null;
  return <Alert><AlertDescription>{[...new Set(editors.map(editor => editor.name))].join("، ")} يحرر هذه المادة الآن. نسّق التعديلات قبل الحفظ لتجنب تعارض النسخ.</AlertDescription></Alert>;
}
