"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, ShieldCheckIcon, ShieldOffIcon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";

import { GuardChip } from "@/components/tahrir/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MediaItem {
  id: string;
  url: string;
  filename: string;
  bytes: number;
  width: number | null;
  height: number | null;
  rightsCleared: boolean;
  flags: string;
  uploadedBy: string;
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)}KB`;

/** مكتبة الوسائط: رفع بالسحب أو النقر، تصفية بحالة الحقوق، ونسخ الرابط أو توثيق الحقوق لكل صورة. */
export function MediaClient({ items, canClear }: { items: MediaItem[]; canClear: boolean }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<"all" | "ok" | "pending">("all");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file || busy) return;
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/tahrir/media", { method: "POST", body: form }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);
    if (response?.ok) {
      toast.success("رُفعت — وثّق حقوقها قبل الاستخدام.");
      router.refresh();
    } else {
      toast.error(data?.error ?? "تعذر الرفع.");
    }
  }

  async function setRights(item: MediaItem, cleared: boolean) {
    const response = await fetch("/api/tahrir/media/rights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, rightsCleared: cleared }),
    }).catch(() => null);
    if (response?.ok) toast.success(cleared ? `وُثّقت حقوق ${item.filename}.` : `سُحب توثيق ${item.filename}.`);
    else toast.error("تعذر تحديث الحقوق.");
    router.refresh();
  }

  const counts = {
    all: items.length,
    ok: items.filter((item) => item.rightsCleared).length,
    pending: items.filter((item) => !item.rightsCleared).length,
  };
  const visible = items.filter((item) => filter === "all" || (filter === "ok" ? item.rightsCleared : !item.rightsCleared));
  const chips: Array<[typeof filter, string, number]> = [
    ["all", "الكل", counts.all],
    ["ok", "موثقة الحقوق", counts.ok],
    ["pending", "بانتظار التوثيق", counts.pending],
  ];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        {chips.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-xs font-semibold transition-colors",
              filter === key ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {label}
            <b className={cn("tabular-nums", filter === key ? "text-primary" : "text-muted-foreground/80")}>{count}</b>
          </button>
        ))}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="رفع صورة"
        onClick={() => fileInput.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInput.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDrag(false);
          void upload(event.dataTransfer.files);
        }}
        className={cn(
          "grid cursor-pointer place-items-center gap-1 rounded-xl border-2 border-dashed bg-card px-4 py-7 text-center transition-colors",
          drag ? "border-primary bg-primary/10" : "border-input hover:border-foreground/40",
        )}
      >
        <UploadCloudIcon className="size-6 text-muted-foreground" />
        <b className="text-[13px]">{busy ? "جارٍ الرفع…" : "أسقط الصور هنا أو اضغط للاختيار"}</b>
        <span className="max-w-[60ch] text-[11px] leading-relaxed text-muted-foreground">
          حتى 8 ميغابايت · <span dir="ltr">PNG / JPEG / WebP</span> — مسار UUID قصير، والحقوق تُفحص قبل الاستخدام (الدستور §12).
        </span>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void upload(event.target.files)} />
      </div>

      {visible.length === 0 ? (
        <Card className="py-8 text-center text-xs text-muted-foreground">لا صور هنا بعد.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => (
            <Card key={item.id} className="gap-0 overflow-hidden py-0">
              <div className="relative aspect-video bg-muted">
                {/* المكتبة تعرض الأصل كما رُفع — التحويلات مرحلة R2 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.filename} loading="lazy" className="size-full object-cover" />
                {item.width && item.height ? (
                  <span className="absolute bottom-1.5 start-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white tabular-nums" dir="ltr">
                    {item.width}×{item.height}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-1.5 p-3">
                <div className="truncate text-xs font-semibold" title={item.filename}>
                  {item.filename}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {kb(item.bytes)} · رفعها {item.uploadedBy}
                </div>
                <GuardChip tone={item.rightsCleared ? "ok" : "warn"} label={item.rightsCleared ? "حقوق موثقة" : "بانتظار توثيق الحقوق"} className="justify-self-start" />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(item.url);
                      toast.success(`نُسخ رابط ${item.filename}`);
                    }}
                  >
                    <CopyIcon data-icon="inline-start" />
                    انسخ الرابط
                  </Button>
                  {canClear ? (
                    <Button size="xs" variant="outline" onClick={() => setRights(item, !item.rightsCleared)}>
                      {item.rightsCleared ? <ShieldOffIcon data-icon="inline-start" /> : <ShieldCheckIcon data-icon="inline-start" />}
                      {item.rightsCleared ? "اسحب التوثيق" : "وثّق الحقوق"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
