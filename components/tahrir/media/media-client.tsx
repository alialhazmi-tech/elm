"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, CopyIcon, SearchIcon, ShieldCheckIcon, ShieldOffIcon, UploadCloudIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { GuardChip } from "@/components/tahrir/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  const chips: Array<[MediaFilter, string, number]> = [
    ["all", "الكل", counts.all],
    ["ok", "موثقة الحقوق", counts.ok],
    ["pending", "بانتظار التوثيق", counts.pending],
  ];
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const pageWindow = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (number) => number === 1 || number === totalPages || Math.abs(number - page) <= 1,
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          {chips.map(([key, label, count]) => (
            <Link
              key={key}
              href={href({ f: key === "all" ? null : key, p: null })}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 font-display text-xs font-semibold whitespace-nowrap transition-colors",
                filter === key ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {label}
              <b className={cn("tabular-nums", filter === key ? "text-primary" : "text-muted-foreground/80")}>{count}</b>
            </Link>
          ))}
        </div>
        <div className="relative ms-auto">
          <SearchIcon className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث باسم الملف…"
            aria-label="بحث في الوسائط"
            className="w-56 bg-card ps-8 pe-7"
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

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {from}–{to} من {total}
          {q ? " (مرشّحة)" : ""}
        </span>
        {totalPages > 1 ? (
          <nav aria-label="ترقيم الصفحات" className="ms-auto flex items-center gap-1">
            <Button asChild size="sm" variant="outline" className={cn(page <= 1 && "pointer-events-none opacity-50")}>
              <Link href={href({ p: page - 1 > 1 ? String(page - 1) : null })} aria-label="الصفحة السابقة">
                <ChevronRightIcon data-icon="inline-start" />
                الأحدث
              </Link>
            </Button>
            {pageWindow.map((number, index) => (
              <span key={number} className="contents">
                {index > 0 && pageWindow[index - 1] !== number - 1 ? <span className="px-1">…</span> : null}
                <Button asChild size="sm" variant={number === page ? "default" : "outline"} className="min-w-8 tabular-nums">
                  <Link href={href({ p: number > 1 ? String(number) : null })} aria-current={number === page ? "page" : undefined}>
                    {number}
                  </Link>
                </Button>
              </span>
            ))}
            <Button asChild size="sm" variant="outline" className={cn(page >= totalPages && "pointer-events-none opacity-50")}>
              <Link href={href({ p: String(page + 1) })} aria-label="الصفحة التالية">
                الأقدم
                <ChevronLeftIcon data-icon="inline-end" />
              </Link>
            </Button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
