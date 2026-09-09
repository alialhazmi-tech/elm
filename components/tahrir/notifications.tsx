"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
type Notice = { id: string; storyId: string; message: string; readAt: string | null; createdAt: string };
export function EditorialNotifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);
  useEffect(() => {
    let stopped = false, pending = false;
    const controller = new AbortController();
    async function refresh() {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      try {
        const res = await fetch("/api/tahrir/notifications", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        if (!res.ok) throw new Error();
        const result = await res.json(); if (!stopped) { setItems(result.notifications); setError(""); }
      } catch { if (!stopped) setError("تعذر تحديث التنبيهات. أعد فتحها للمحاولة."); }
      finally { pending = false; }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { stopped = true; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [open]);
  const unread = items.filter(item => !item.readAt);
  async function markRead() {
    setMarking(true);
    const ids = unread.map(item => item.id);
    try {
      const res = await fetch("/api/tahrir/notifications", { method: "POST", signal: AbortSignal.timeout(10_000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!res.ok) throw new Error();
      setItems(current => current.map(item => ids.includes(item.id) ? { ...item, readAt: new Date().toISOString() } : item));
    } catch { setError("تعذر تعليم التنبيهات كمقروءة."); }
    finally { setMarking(false); }
  }
  return <><Button size="icon-sm" variant="ghost" className="relative" onClick={() => setOpen(true)} aria-label={`التنبيهات${unread.length ? `، ${unread.length} غير مقروءة ضمن الأحدث` : ""}`}><BellIcon />{!!unread.length && <span className="absolute end-0 top-0 size-2 rounded-full bg-primary" />}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg" dir="rtl"><DialogHeader><DialogTitle>تنبيهات التحرير</DialogTitle><DialogDescription>آخر 30 تنبيهًا للإسناد وملاحظات المراجعة والإعادة للتعديل.</DialogDescription></DialogHeader>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{!!unread.length && <Button variant="outline" size="sm" disabled={marking} onClick={() => void markRead()}>تعليم الظاهر كمقروء</Button>}<ul className="max-h-96 space-y-2 overflow-y-auto">{items.map(item => <li key={item.id} className={`rounded-lg border p-3 text-sm ${item.readAt ? "" : "bg-muted/60"}`}><Link href={`/tahrir/editor/${item.storyId}`} onClick={() => setOpen(false)} className="block leading-7 hover:underline">{!item.readAt && <span className="me-1 text-xs font-bold">جديد ·</span>}{item.message}</Link><time className="text-xs text-muted-foreground" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("ar-SA-u-ca-gregory-nu-latn")}</time></li>)}</ul>{!items.length && !error && <p className="text-sm text-muted-foreground">لا توجد تنبيهات بعد.</p>}</DialogContent></Dialog></>;
}
