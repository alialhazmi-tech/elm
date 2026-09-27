"use client";

import { useEffect, useRef, useState } from "react";
import { FileAudioIcon, UploadCloudIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toLatinDigits } from "@/lib/format";
import { formatPodcastDuration } from "@/lib/podcasts";
import { MAX_AUDIO_BYTES, audioKindFor } from "@/lib/podcast-input";
import { apiCall } from "@/lib/tahrir/client-api";
import { formatBytes, readAudioDuration, uploadPodcastAudio, type UploadedAudio } from "@/lib/tahrir/podcast-upload";
import { cn } from "@/lib/utils";

import type { AdminEpisode, ShowOption } from "./types";

type Upload =
  | { state: "idle" }
  | { state: "uploading"; file: File; sent: number; duration: number | null }
  | { state: "done"; file: File; audio: UploadedAudio; duration: number | null }
  | { state: "failed"; file: File; error: string; duration: number | null };

/** تاريخ اليوم بتوقيت الرياض لحقل التاريخ (YYYY-MM-DD). */
function riyadhDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(date);
}

/** اليوم = الآن (فتتصدر الحلقة)، ويوم سابق = منتصف نهاره بتوقيت الرياض. */
function publishedAtFor(day: string, original?: string): string {
  if (original && riyadhDay(new Date(original)) === day) return original;
  if (day === riyadhDay(new Date())) return new Date().toISOString();
  return new Date(`${day}T12:00:00+03:00`).toISOString();
}

export function EpisodeForm({
  shows,
  showId: initialShowId,
  editing,
  busy,
  setBusy,
  onDone,
}: {
  shows: ShowOption[];
  showId?: string;
  editing?: AdminEpisode;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [showId, setShowId] = useState(editing?.showId ?? initialShowId ?? shows[0]?.id ?? "");
  const [upload, setUpload] = useState<Upload>({ state: "idle" });
  const [drag, setDrag] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);

  // إغلاق اللوح أثناء الرفع يلغيه ويحرر أجزاءه.
  useEffect(() => () => controller.current?.abort(), []);

  async function start(file: File | undefined) {
    if (!file || upload.state === "uploading") return;
    if (!audioKindFor(file.name)) return toast.error("الصيغ المقبولة: MP3 أو M4A.");
    if (file.size > MAX_AUDIO_BYTES) return toast.error("الحد الأقصى 500 ميجابايت.");
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const duration = await readAudioDuration(file);
    setUpload({ state: "uploading", file, sent: 0, duration });
    try {
      const audio = await uploadPodcastAudio(file, {
        signal: abort.signal,
        onProgress: ({ sent }) => setUpload((current) => (current.state === "uploading" && current.file === file ? { ...current, sent } : current)),
      });
      setUpload({ state: "done", file, audio, duration });
    } catch (error) {
      if (abort.signal.aborted) return;
      setUpload({ state: "failed", file, duration, error: error instanceof Error ? error.message : "تعذر رفع الملف." });
    }
  }

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setUpload({ state: "idle" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = {
      showId,
      title: form.get("title"),
      guest: form.get("guest"),
      description: form.get("description"),
      publishedAt: publishedAtFor(String(form.get("day") ?? ""), editing?.publishedAt),
    };
    setBusy(true);
    const result = editing
      ? await apiCall(`/api/tahrir/podcasts/episodes/${editing.id}`, { method: "PATCH", body: fields }, { fallback: "تعذر الحفظ." })
      : upload.state === "done"
        ? await apiCall("/api/tahrir/podcasts/episodes", {
            method: "POST",
            body: { ...fields, key: upload.audio.key, durationSeconds: upload.duration },
          }, { fallback: "تعذر نشر الحلقة.", timeoutMs: 60_000 })
        : null;
    setBusy(false);
    if (!result) return toast.error("ارفع الملف الصوتي أولًا.");
    if (result.ok) onDone(editing ? "حُفظت الحلقة." : "نُشرت الحلقة في الموقع والتطبيق.");
    else toast.error(result.error);
  }

  const duration = editing ? editing.durationSeconds : upload.state === "idle" ? null : upload.duration;
  const canPublish = Boolean(editing) || upload.state === "done";

  return (
    <form onSubmit={submit} className="flex min-h-full flex-col">
      <SheetHeader className="border-b border-border/70 p-4">
        <SheetTitle>{editing ? "تعديل الحلقة" : "حلقة جديدة"}</SheetTitle>
        <SheetDescription>
          {editing ? "الملف الصوتي ثابت؛ لتغييره انشر حلقة جديدة وأخفِ هذه." : "تُنشر فورًا في صفحة البرنامج و/podcasts والتطبيق."}
        </SheetDescription>
      </SheetHeader>

      <div className="grid flex-1 gap-4 p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="e-show">البرنامج</Label>
          <Select value={showId} onValueChange={setShowId}>
            <SelectTrigger id="e-show" className="w-full">
              <SelectValue placeholder="اختر البرنامج" />
            </SelectTrigger>
            <SelectContent>
              {shows.map((show) => (
                <SelectItem key={show.id} value={show.id}>
                  <span className="size-3 shrink-0 rounded-[3px]" style={{ background: show.accent }} aria-hidden="true" />
                  {show.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="e-title">عنوان الحلقة</Label>
          <Input id="e-title" name="title" defaultValue={editing?.title} required minLength={2} maxLength={200} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="e-guest">الضيف</Label>
          <Input id="e-guest" name="guest" defaultValue={editing?.guest} maxLength={80} placeholder="د. فلان الفلاني" />
          <span className="text-[11px] text-muted-foreground">اختياري. يظهر بجانب العنوان في المشغل.</span>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="e-desc">الوصف</Label>
          <Textarea id="e-desc" name="description" defaultValue={editing?.description} rows={5} maxLength={2000} className="leading-relaxed" />
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">الملف الصوتي</span>
          {editing ? (
            <FileRow name={editing.filename} meta={`${editing.mime === "audio/mpeg" ? "MP3" : "M4A"} · ${formatBytes(editing.byteLength)}${duration ? ` · المدة ${toLatinDigits(formatPodcastDuration(String(duration)) ?? "")}` : ""}`} />
          ) : upload.state === "idle" ? (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDrag(false);
                void start(event.dataTransfer.files[0]);
              }}
              className={cn(
                "grid cursor-pointer place-items-center gap-1 rounded-xl border-2 border-dashed bg-card px-4 py-6 text-center transition-colors",
                drag ? "border-primary bg-primary/10" : "border-input hover:border-foreground/40",
              )}
            >
              <UploadCloudIcon className="size-6 text-muted-foreground" />
              <b className="text-[13px]">أسقط الملف هنا أو اضغط للاختيار</b>
            </button>
          ) : (
            <div className="grid gap-2.5 rounded-xl border border-input bg-muted/30 p-3">
              <FileRow
                name={upload.file.name}
                meta={`${audioKindFor(upload.file.name)?.ext.toUpperCase()} · ${formatBytes(upload.file.size)}${upload.duration ? ` · المدة ${toLatinDigits(formatPodcastDuration(String(upload.duration)) ?? "")}` : ""}`}
                onRemove={cancel}
                removeLabel={upload.state === "uploading" ? "إلغاء الرفع" : "إزالة الملف"}
              />
              {upload.state === "uploading" ? (
                <>
                  {/* شريط بسيط: مؤشر Progress المشترك يمتد بـflex-1 إلى العرض كله مهما كانت القيمة. */}
                  <div
                    role="progressbar"
                    aria-label="تقدم الرفع"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.floor((upload.sent / upload.file.size) * 100)}
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <div data-slot="progress-indicator" className="h-full rounded-full bg-primary" style={{ width: `${(upload.sent / upload.file.size) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                    <span>يُرفع… {toLatinDigits(Math.round(upload.sent / 1048576))} من {toLatinDigits(Math.round(upload.file.size / 1048576))} ميجابايت</span>
                    <span dir="ltr">{toLatinDigits(Math.floor((upload.sent / upload.file.size) * 100))}%</span>
                  </div>
                </>
              ) : null}
              {upload.state === "done" ? <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">اكتمل الرفع والتحقق من الملف.</span> : null}
              {upload.state === "failed" ? (
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-destructive">{upload.error}</span>
                  <Button type="button" size="xs" variant="outline" onClick={() => void start(upload.file)}>أعد المحاولة</Button>
                </div>
              ) : null}
            </div>
          )}
          {!editing ? (
            <span className="text-[11px] leading-relaxed text-muted-foreground">
              <span dir="ltr">MP3</span> أو <span dir="ltr">M4A</span> حتى 500 ميجابايت. يُرفع على أجزاء، ويمكنك مواصلة تعبئة الحقول أثناء الرفع.
            </span>
          ) : null}
          <input ref={fileInput} type="file" accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a" hidden onChange={(event) => void start(event.target.files?.[0])} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="e-day">تاريخ الحلقة</Label>
          <Input id="e-day" name="day" type="date" dir="ltr" className="justify-end" defaultValue={riyadhDay(editing ? new Date(editing.publishedAt) : new Date())} max={riyadhDay(new Date())} required />
          <span className="text-[11px] text-muted-foreground">يحدد ترتيبها في القائمة. الافتراضي اليوم.</span>
        </div>
      </div>

      <SheetFooter className="sticky bottom-0 flex-row items-center gap-2 border-t border-border/70 bg-background p-4">
        <Button type="submit" disabled={busy || !canPublish || !showId}>{editing ? "حفظ" : busy ? "يُنشر…" : "نشر الحلقة"}</Button>
        {!editing && !canPublish ? <span className="ms-auto text-[11px] text-muted-foreground">يتفعّل النشر بعد اكتمال الرفع</span> : null}
      </SheetFooter>
    </form>
  );
}

function FileRow({ name, meta, onRemove, removeLabel }: { name: string; meta: string; onRemove?: () => void; removeLabel?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
        <FileAudioIcon className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span dir="ltr" className="truncate text-end text-[13px] font-semibold">{name}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{meta}</span>
      </div>
      {onRemove ? (
        <Button type="button" size="icon-xs" variant="ghost" aria-label={removeLabel} onClick={onRemove}>
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}
