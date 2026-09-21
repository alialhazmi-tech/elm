"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CopyIcon, SearchIcon, ShieldCheckIcon, ShieldOffIcon, UploadCloudIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { GuardChip } from "@/components/tahrir/badges";
import { Pagination } from "@/components/tahrir/pagination";
import { SegmentedFilter } from "@/components/tahrir/segmented-filter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiCall } from "@/lib/tahrir/client-api";
import { pageRange } from "@/lib/tahrir/pagination";
import type { MediaFilter } from "@/lib/tahrir/service";
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

interface Props {
  items: MediaItem[];
  canClear: boolean;
  filter: MediaFilter;
  q: string;
  counts: Record<MediaFilter, number>;
  page: number;
  perPage: number;
  total: number;
}

/** مكتبة الوسائط: رفع بالسحب أو النقر، تصفية وبحث وترقيم على الخادم، ونسخ الرابط أو توثيق الحقوق لكل صورة. */
export function MediaClient({ items, canClear, filter, q, counts, page, perPage, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fileInput = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(q);

  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const suffix = next.toString();
    return suffix ? `${pathname}?${suffix}` : pathname;
  };

  useEffect(() => {
    if (query.trim() === q) return;
    const timer = setTimeout(() => router.replace(href({ q: query.trim() || null, p: null })), 350);
    return () => clearTimeout(timer);
    // href يعتمد على params/pathname الثابتين أثناء الكتابة؛ إعادة الإنشاء تُلغي المؤقت بلا داعٍ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, q]);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file || busy) return;
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    // الرفع قد يطول على شبكة الجوال: مهلة أطول من الافتراضية.
    const result = await apiCall("/api/tahrir/media", { method: "POST", body: form }, { timeoutMs: 90_000, fallback: "تعذر الرفع." });
    setBusy(false);
    if (result.ok) {
      toast.success("رُفعت — وثّق حقوقها قبل الاستخدام.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function setRights(item: MediaItem, cleared: boolean) {
    const result = await apiCall("/api/tahrir/media/rights", { method: "POST", body: { id: item.id, rightsCleared: cleared } }, { fallback: "تعذر تحديث الحقوق." });
    if (result.ok) toast.success(cleared ? `وُثّقت حقوق ${item.filename}.` : `سُحب توثيق ${item.filename}.`);
    else toast.error("تعذر تحديث الحقوق.");
    router.refresh();
  }

  const chips: ReadonlyArray<{ value: MediaFilter; label: string; count: number }> = [
    { value: "all", label: "الكل", count: counts.all },
    { value: "ok", label: "موثقة الحقوق", count: counts.ok },
    { value: "pending", label: "بانتظار التوثيق", count: counts.pending },
  ];
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const { from, to } = pageRange(page, perPage, total);

  return (
    <div className="grid gap-3">
      {/* صف المرشّحات يلتف على الجوال: الشريط المقسّم في سطر والبحث بعرض كامل تحته. */}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedFilter options={chips} value={filter} hrefFor={(value) => href({ f: value === "all" ? null : value, p: null })} ariaLabel="تصفية الوسائط بحالة الحقوق" />
        <div className="relative w-full sm:ms-auto sm:w-auto">
          <SearchIcon className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث باسم الملف…"
            aria-label="بحث في الوسائط"
            className="w-full bg-card ps-8 pe-7 sm:w-56"
          />
          {query ? (
            <Button type="button" size="icon-xs" variant="ghost" aria-label="مسح البحث" className="absolute top-1/2 end-1 -translate-y-1/2" onClick={() => setQuery("")}>
              <XIcon />
            </Button>
          ) : null}
        </div>
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

      {items.length === 0 ? (
        <Card className="py-8 text-center text-xs text-muted-foreground">{q ? "لا صور تطابق البحث." : "لا صور هنا بعد."}</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
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

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(number) => href({ p: number > 1 ? String(number) : null })}
        summary={`${from}–${to} من ${total}${q ? " (مرشّحة)" : ""}`}
      />
    </div>
  );
}
