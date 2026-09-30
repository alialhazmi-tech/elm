"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckIcon, Code2Icon, ExternalLinkIcon, ImagePlusIcon, SaveIcon, SendIcon, UploadCloudIcon } from "lucide-react";

import type { JakCodeReport } from "@/lib/jak-report-types";
import { JakCodePreview } from "@/components/jak-code-preview";
import { useDraftRecovery, useDraftTabToken } from "@/components/tahrir/use-draft-recovery";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Status = JakCodeReport["status"];
type MediaItem = { url: string; filename: string };

type Snapshot = Pick<JakCodeReport, "title" | "excerpt" | "image" | "html" | "css" | "showOnHomepage">;

const STATUS_LABELS: Record<Status, string> = {
  draft: "مسودة",
  review: "بانتظار المراجعة",
  published: "منشور",
  archived: "مؤرشف",
};

const EMPTY: Snapshot = { title: "", excerpt: "", image: null, html: "", css: "", showOnHomepage: false };

function snapshotOf(report: JakCodeReport | null): Snapshot {
  return report
    ? {
        title: report.title,
        excerpt: report.excerpt,
        image: report.image,
        html: report.html,
        css: report.css,
        showOnHomepage: report.showOnHomepage,
      }
    : EMPTY;
}

function EditorCodeField({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label htmlFor={id} className="font-display text-sm font-bold">{label}</Label>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <textarea
        id={id}
        dir="ltr"
        spellCheck={false}
        wrap="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[25rem] w-full resize-y rounded-xl border border-slate-700 bg-[#0d1520] px-4 py-3 font-mono text-[13px] leading-6 text-slate-100 shadow-inner outline-none transition-colors placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/30"
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

export function JakReportEditor({
  initial,
  actorId,
  recentMedia,
  canSubmit,
  canPublish,
  canArchive,
  canRestore,
}: {
  initial: JakCodeReport | null;
  actorId: string;
  recentMedia: MediaItem[];
  canSubmit: boolean;
  canPublish: boolean;
  canArchive: boolean;
  canRestore: boolean;
}) {
  const router = useRouter();
  const tabToken = useDraftTabToken();
  const [id, setId] = useState(initial?.id ?? "");
  const [version, setVersion] = useState(initial?.version ?? 0);
  const [status, setStatus] = useState<Status>(initial?.status ?? "draft");
  const [form, setForm] = useState<Snapshot>(() => snapshotOf(initial));
  const [busy, setBusy] = useState<"save" | "review" | "publish" | "archive" | "restore" | "upload" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const initialSnapshot = useMemo(() => snapshotOf(initial), [initial]);
  const draftKey = `tahrir:jak-code-report:${actorId}:${id || tabToken}`;
  const recovery = useDraftRecovery(draftKey, form, { version, updatedAt: initial?.updatedAt ?? null });
  const savedSnapshot = useRef(initialSnapshot);
  const [savedEncoded, setSavedEncoded] = useState(() => JSON.stringify(initialSnapshot));
  const savedReport = useRef(initial);
  const stableId = useRef(initial?.id ?? "");
  const snapshot = form;
  const dirty = JSON.stringify(snapshot) !== savedEncoded;

  useEffect(() => {
    const recovered = recovery.recovery;
    if (!recovered || !recoveryNotice) return;
    // The recovery hook reads localStorage after hydration. Restoring that value is
    // intentionally a state sync so the user can keep working on the recovered draft.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(recovered);
    setRecoveryNotice(false);
  }, [recovery.recovery, recoveryNotice]);

  function patch(partial: Partial<Snapshot>) {
    setForm((current) => ({ ...current, ...partial }));
    setMessage(null);
  }

  async function post(payload: Record<string, unknown>) {
    const timeout = AbortSignal.timeout(30_000);
    let response: Response | null = null;
    let timedOut = false;
    try {
      response = await fetch("/api/tahrir/jak-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: timeout,
      });
    } catch (error) {
      timedOut = timeout.aborted || (error instanceof Error && error.name === "TimeoutError");
    }
    if (!response) {
      return {
        ok: false as const,
        status: timedOut ? 408 : 0,
        error: timedOut
          ? "انتهت مهلة الطلب. قد يكون الخادم استلم العملية؛ بقيت تعديلاتك كما هي، ويمكنك إعادة المحاولة بأمان."
          : "تعذر الاتصال بالخادم. بقيت تعديلاتك في المحرر ويمكنك إعادة المحاولة.",
      };
    }
    const data = await response?.json().catch(() => null) as { ok?: boolean; report?: JakCodeReport; error?: string } | null;
    if (!response?.ok || !data?.report) {
      return { ok: false as const, status: response?.status ?? 0, error: data?.error ?? "تعذر تنفيذ العملية. بقيت تعديلاتك في المحرر." };
    }
    return { ok: true as const, report: data.report };
  }

  async function saveDraft(): Promise<JakCodeReport | null> {
    if (busy) return null;
    setBusy("save");
    setMessage(null);
    // Allocate the client identity before the first request. A retry after an
    // ambiguous timeout must address the same row and expectedVersion.
    if (!stableId.current) stableId.current = crypto.randomUUID();
    const nextId = stableId.current;
    const result = await post({ action: "save", id: nextId, expectedVersion: id ? version : 0, ...snapshot });
    if (!result.ok) {
      setBusy(null);
      setMessage({ kind: "error", text: result.error });
      return null;
    }
    setId(result.report.id);
    setVersion(result.report.version);
    setStatus(result.report.status);
    savedReport.current = result.report;
    savedSnapshot.current = snapshot;
    setSavedEncoded(JSON.stringify(snapshot));
    recovery.markSaved(snapshot);
    setBusy(null);
    const saveMessage = result.report.status === "published"
      ? "حُفظت تعديلات التقرير المنشور."
      : result.report.status === "review"
        ? "حُفظت تعديلات التقرير بانتظار المراجعة."
        : "حُفظت المسودة.";
    setMessage({ kind: "ok", text: saveMessage });
    if (!id) router.replace(`/tahrir/jak-reports/${result.report.id}`);
    return result.report;
  }

  async function transition(nextStatus: Status, action: "review" | "publish" | "archive" | "restore") {
    if (busy) return;
    if (action === "archive" && !window.confirm("أرشفة هذا التقرير؟ سيختفي من العرض المنشور.")) return;
    setBusy(action);
    setMessage(null);
    let savedBeforeTransition: JakCodeReport | null = null;
    if (dirty) {
      // saveDraft has its own loading state; release the transition lock while it
      // persists so the explicit transition always saves the current code first.
      setBusy(null);
      savedBeforeTransition = await saveDraft();
      if (!savedBeforeTransition) return;
      setBusy(action);
      setMessage(null);
    }
    const reportId = id || savedReport.current?.id;
    if (!reportId) {
      setBusy(null);
      setMessage({ kind: "error", text: "احفظ المسودة أولًا قبل تغيير حالتها." });
      return;
    }
    const result = await post({ action: "transition", id: reportId, status: nextStatus, expectedVersion: savedBeforeTransition?.version ?? version });
    if (!result.ok) {
      setBusy(null);
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setId(result.report.id);
    setVersion(result.report.version);
    setStatus(result.report.status);
    savedReport.current = result.report;
    savedSnapshot.current = snapshot;
    setSavedEncoded(JSON.stringify(snapshot));
    recovery.markSaved(snapshot);
    if (nextStatus === "published" || nextStatus === "archived") recovery.clear();
    setBusy(null);
    const transitionMessage = nextStatus === "review"
      ? "أُرسلت للمراجعة."
      : nextStatus === "published"
        ? "نُشر التقرير."
        : nextStatus === "archived"
          ? "أُرشف التقرير."
          : "استُعيد التقرير إلى المسودة.";
    setMessage({ kind: "ok", text: transitionMessage });
  }

  async function uploadCover(file: File | undefined) {
    if (!file || busy) return;
    setBusy("upload");
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/tahrir/media", { method: "POST", body }).catch(() => null);
    const data = await response?.json().catch(() => null) as { url?: string; error?: string } | null;
    setBusy(null);
    if (!response?.ok || !data?.url) {
      setMessage({ kind: "error", text: data?.error ?? "تعذر رفع صورة الغلاف." });
      return;
    }
    patch({ image: data.url });
    setMessage({ kind: "ok", text: "رُفعت الصورة، احفظ المسودة لتثبيتها." });
  }

  const statusBadge = status === "published" ? "success" : status === "review" ? "warning" : status === "archived" ? "outline" : "secondary";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label="العودة إلى تقارير جاك">
            <Link href="/tahrir/jak-reports"><ArrowRightIcon /></Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-extrabold">{initial ? "تحرير تقرير جاك" : "تقرير جاك جديد"}</h1>
              <Badge variant={statusBadge}>{STATUS_LABELS[status]}</Badge>
              {initial?.sourceUrl ? <Badge variant="info">مستورد</Badge> : null}
              {dirty ? <span className="text-xs text-amber-700 dark:text-amber-300">تعديلات غير محفوظة</span> : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">اكتب HTML وCSS كما هما، ثم راجع المعاينة قبل اعتماد التقرير.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => void saveDraft()} disabled={Boolean(busy) || status === "archived"} loading={busy === "save"}>
            <SaveIcon data-icon="inline-start" /> {status === "draft" ? "حفظ المسودة" : "حفظ التعديلات"}
          </Button>
          {canSubmit && status === "draft" ? (
            <Button variant="secondary" size="sm" onClick={() => void transition("review", "review")} disabled={Boolean(busy)} loading={busy === "review"}>
              <SendIcon data-icon="inline-start" /> إرسال للمراجعة
            </Button>
          ) : null}
          {canPublish && (status === "review" || status === "draft") ? (
            <Button size="sm" onClick={() => void transition("published", "publish")} disabled={Boolean(busy) || !id} loading={busy === "publish"} title={!id ? "احفظ المسودة أولًا" : undefined}>
              <CheckIcon data-icon="inline-start" /> نشر
            </Button>
          ) : null}
          {canArchive && status !== "archived" ? (
            <Button variant="destructive" size="sm" onClick={() => void transition("archived", "archive")} disabled={Boolean(busy)} loading={busy === "archive"}>
              أرشفة
            </Button>
          ) : null}
          {canRestore && status === "archived" ? (
            <Button variant="outline" size="sm" onClick={() => void transition("draft", "restore")} disabled={Boolean(busy)} loading={busy === "restore"}>
              استعادة إلى المسودة
            </Button>
          ) : null}
        </div>
      </div>

      {message ? <Alert variant={message.kind === "error" ? "destructive" : "default"}><AlertDescription>{message.text}</AlertDescription></Alert> : null}
      {recovery.recovery && !recoveryNotice ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            وُجدت نسخة محلية أحدث من آخر حفظ. استُعيدت تلقائيًا ويمكنك متابعة التحرير.
            <Button size="xs" variant="ghost" onClick={() => { recovery.dismiss(); setForm(savedSnapshot.current); setRecoveryNotice(true); }}>تجاهل النسخة المحلية</Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="grid min-w-0 gap-4">
          <Card className="overflow-hidden border-primary/20">
            <CardHeader className="border-b bg-primary/[0.035]">
              <CardTitle className="flex items-center gap-2"><Code2Icon className="size-4 text-primary" aria-hidden /> مساحة الكود</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 p-4">
              <EditorCodeField id="jak-report-html" label="HTML" hint="استخدم HTML كاملًا داخل جسم التقرير. تُحفظ القيمة كما هي." value={form.html} onChange={(html) => patch({ html })} />
              <EditorCodeField id="jak-report-css" label="CSS" hint="اختياري. يحقن في المعاينة مع عزل التقرير." value={form.css} onChange={(css) => patch({ css })} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex-row justify-between border-b">
              <CardTitle>المعاينة الحالية</CardTitle>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className={cn("size-2 rounded-full", dirty ? "bg-amber-500" : "bg-emerald-500")} aria-hidden />
                {dirty ? "غير محفوظة" : "مطابقة لآخر حفظ"}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <JakCodePreview html={form.html} css={form.css} title={form.title || "معاينة جاك"} />
            </CardContent>
          </Card>
        </div>

        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader><CardTitle>بيانات التقرير</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-1.5"><Label htmlFor="jak-report-title">العنوان</Label><Input id="jak-report-title" value={form.title} onChange={(event) => patch({ title: event.target.value })} placeholder="عنوان التقرير" /></div>
              <div className="grid gap-1.5"><Label htmlFor="jak-report-excerpt">النبذة</Label><Textarea id="jak-report-excerpt" rows={4} value={form.excerpt} onChange={(event) => patch({ excerpt: event.target.value })} placeholder="وصف مختصر يظهر في صفحة جاك العلم" /></div>
              <div className="flex items-start gap-2 rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-muted/40">
                <Checkbox id="jak-report-homepage" checked={form.showOnHomepage} onCheckedChange={(checked) => patch({ showOnHomepage: checked === true })} />
                <Label htmlFor="jak-report-homepage" className="grid cursor-pointer gap-0.5"><span className="font-semibold">إظهار في صفحة جاك العلم</span><span className="text-[11px] leading-relaxed text-muted-foreground">يعرض التقرير في قسم جاك العلم العام.</span></Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ImagePlusIcon className="size-4" aria-hidden /> صورة الغلاف</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {form.image ? <div className="relative overflow-hidden rounded-lg border bg-muted"><img src={form.image} alt="غلاف التقرير" className="aspect-video w-full object-cover" />{/* eslint-disable-line @next/next/no-img-element */}<button type="button" className="absolute end-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white hover:bg-black" onClick={() => patch({ image: null })}>إزالة</button></div> : <div className="grid place-items-center rounded-lg border border-dashed bg-muted/30 px-3 py-7 text-center text-xs text-muted-foreground">اختر صورة من المكتبة أو ارفع صورة جديدة</div>}
              {recentMedia.length ? <div className="grid grid-cols-4 gap-1.5">{recentMedia.map((item) => <button type="button" key={item.url} className={cn("overflow-hidden rounded-md border-2 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", form.image === item.url ? "border-primary" : "border-transparent")} onClick={() => patch({ image: item.url })} aria-label={`اختيار ${item.filename}`} aria-pressed={form.image === item.url}><img src={item.url} alt="" className="aspect-square w-full object-cover" loading="lazy" />{/* eslint-disable-line @next/next/no-img-element */}</button>)}</div> : null}
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadCover(event.target.files?.[0])} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={Boolean(busy)} loading={busy === "upload"}><UploadCloudIcon data-icon="inline-start" /> رفع صورة</Button>
            </CardContent>
          </Card>

          {id ? <Card className="gap-2 p-3"><p className="text-xs text-muted-foreground">روابط</p><Button asChild variant="outline" size="sm"><Link href={`/tahrir/jak-reports/${id}/preview`}><ExternalLinkIcon data-icon="inline-start" /> معاينة خاصة</Link></Button>{status === "published" ? <Button asChild variant="ghost" size="sm"><Link href={`/jak/${id}/${encodeURIComponent(form.title || "report")}`} target="_blank"><ExternalLinkIcon data-icon="inline-start" /> فتح الرابط العام</Link></Button> : null}{initial?.sourceUrl ? <a href={initial.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"><ExternalLinkIcon className="size-3" aria-hidden /> فتح مصدر الاستيراد</a> : null}</Card> : null}
        </aside>
      </div>
    </div>
  );
}
