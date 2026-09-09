"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BellIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
type Notice = { id: string; storyId: string; message: string; readAt: string | null; createdAt: string };
export function EditorialNotifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    let stopped = false, pending = false;
    const controller = new AbortController();
    async function refresh() {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      try {
        const res = await fetch("/api/tahrir/notifications", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        if (!res.ok) throw new Error();
        const result = await res.json();
        if (!stopped) {
          const notices: Notice[] = result.notifications;
          const fresh = notices.filter(item => !item.readAt && !seen.current?.has(item.id));
          const firstLoad = seen.current === null;
          seen.current = new Set(notices.map(item => item.id));
          setItems(notices); setError("");
          if (fresh.length) {
            toast.info(firstLoad ? `لديك ${fresh.length} من تنبيهات التحرير غير المقروءة` : fresh.length === 1 ? fresh[0].message : `وصلتك ${fresh.length} تنبيهات تحرير جديدة`, { id: "editorial-notices", duration: 8000, action: { label: "عرض التنبيهات", onClick: () => setOpen(true) } });
            if (!firstLoad && pathname === "/tahrir/tasks") router.refresh();
          }
        }
      } catch { if (!stopped) setError("تعذر تحديث التنبيهات. أعد فتحها للمحاولة."); }
      finally { pending = false; }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 15_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { stopped = true; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, [open, pathname, router]);
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
  return <>
    <Button size="icon-sm" variant="ghost" className="relative" onClick={() => setOpen(true)} aria-label={`التنبيهات${unread.length ? `، ${unread.length} غير مقروءة ضمن الأحدث` : ""}`}><BellIcon />{!!unread.length && <span aria-hidden="true" className="absolute -end-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">{unread.length}</span>}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg" dir="rtl">
      <DialogHeader><DialogTitle>تنبيهات التحرير</DialogTitle><DialogDescription>آخر 30 تنبيهًا للإسناد وملاحظات المراجعة والإعادة للتعديل.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2"><Button asChild size="sm"><Link href="/tahrir/tasks?filter=assigned" onClick={() => setOpen(false)}>المواد المسندة إليّ في مهامي</Link></Button>{!!unread.length && <Button variant="outline" size="sm" disabled={marking} onClick={() => void markRead()}>تعليم الظاهر كمقروء</Button>}</div>
      <ul className="max-h-96 space-y-2 overflow-y-auto">{items.map(item => <li key={item.id} className={`rounded-lg border p-3 text-sm ${item.readAt ? "" : "bg-muted/60"}`}><Link href={`/tahrir/editor/${item.storyId}`} onClick={() => setOpen(false)} className="block leading-7 hover:underline">{!item.readAt && <span className="me-1 text-xs font-bold">جديد ·</span>}{item.message}</Link><time className="text-xs text-muted-foreground" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" })} (الرياض)</time></li>)}</ul>
      {!items.length && !error && <p className="text-sm text-muted-foreground">لا توجد تنبيهات بعد.</p>}
    </DialogContent></Dialog>
  </>;
}
