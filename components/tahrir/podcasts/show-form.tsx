"use client";

import { useRef, useState } from "react";
import { UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ALELM_YOUTUBE } from "@/lib/podcasts";
import { apiCall } from "@/lib/tahrir/client-api";
import { cn } from "@/lib/utils";

import type { AdminShow } from "./types";

/** ألوان البرامج الحالية وأخوات لها بتباين كافٍ مع النص الأبيض. */
const PALETTE = ["#b35c1e", "#2b5c9e", "#a8761a", "#1f8f8a", "#7b3b5c", "#3b4a5e"];

/** لون مقترح من الغلاف: متوسط البكسلات مرجّحًا بالتشبع، ثم يُعتم حتى يحمل النص الأبيض. */
async function accentFromImage(url: string): Promise<string | null> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0, 32, 32);
  const { data } = context.getImageData(0, 0, 32, 32);
  let r = 0, g = 0, b = 0, weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const w = (max - min) / 255 + 0.05;
    r += data[i] * w; g += data[i + 1] * w; b += data[i + 2] * w; weight += w;
  }
  let rgb = [r / weight, g / weight, b / weight];
  const luminance = (c: number[]) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  while (luminance(rgb) > 0.32) rgb = rgb.map((c) => c * 0.9);
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

export function ShowForm({
  editing,
  busy,
  setBusy,
  onDone,
}: {
  editing?: AdminShow;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onDone: (message: string, id: string) => void;
}) {
  const [cover, setCover] = useState<string | null>(editing?.cover ?? null);
  const [accent, setAccent] = useState(editing?.accent ?? PALETTE[0]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [visible, setVisible] = useState(editing?.visible ?? true);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const body = new FormData();
    body.set("file", file);
    const result = await apiCall<{ url: string }>("/api/tahrir/podcasts/cover", { method: "POST", body }, { fallback: "تعذر رفع الغلاف.", timeoutMs: 90_000 });
    setUploading(false);
    if (!result.ok) return toast.error(result.error);
    setCover(result.data.url);
    const color = await accentFromImage(URL.createObjectURL(file));
    if (color) {
      setSuggested(color);
      setAccent(color);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = editing?.id ?? String(form.get("id") ?? "").trim().toLowerCase();
    const body = {
      id,
      name: form.get("name"),
      description: form.get("description"),
      cover,
      accent,
      feedUrl: form.get("feedUrl"),
      youtube: form.get("youtube"),
      visible,
    };
    setBusy(true);
    const result = editing
      ? await apiCall(`/api/tahrir/podcasts/shows/${editing.id}`, { method: "PATCH", body }, { fallback: "تعذر الحفظ." })
      : await apiCall("/api/tahrir/podcasts/shows", { method: "POST", body }, { fallback: "تعذر إضافة البرنامج." });
    setBusy(false);
    if (result.ok) onDone(editing ? "حُفظ البرنامج." : "أُضيف البرنامج.", id);
    else toast.error(result.error);
  }

  const swatches = suggested && !PALETTE.includes(suggested) ? [suggested, ...PALETTE] : PALETTE;

  return (
    <form onSubmit={submit} className="flex min-h-full flex-col">
      <SheetHeader className="border-b border-border/70 p-4">
        <SheetTitle>{editing ? `إعدادات ${editing.name}` : "برنامج جديد"}</SheetTitle>
        <SheetDescription>البرنامج كيان مستقل له صفحته، وليس مادة في المواد.</SheetDescription>
      </SheetHeader>

      <div className="grid flex-1 gap-4 p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="s-name">اسم البرنامج</Label>
          <Input id="s-name" name="name" defaultValue={editing?.name} required minLength={2} maxLength={60} placeholder="مثلًا: مجالس" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="s-id">رابط الصفحة</Label>
          {editing ? (
            <div dir="ltr" className="rounded-md border border-input bg-muted/30 px-3 py-2 text-end text-sm text-muted-foreground">alelm.net{editing.publicPath}</div>
          ) : (
            <div dir="ltr" className="flex h-9 items-stretch overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring/50">
              <span className="flex items-center border-e border-input bg-muted/40 px-2.5 text-[13px] text-muted-foreground">alelm.net/podcasts/</span>
              <input id="s-id" name="id" required pattern="[a-z][a-z0-9\-]{0,38}[a-z0-9]" maxLength={40} autoComplete="off" placeholder="majalis" className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none" />
            </div>
          )}
          <span className="text-[11px] text-muted-foreground">
            {editing ? "الرابط ثابت حفاظًا على الروابط المنشورة." : "حروف لاتينية صغيرة وأرقام وشرطات. لا يتغير بعد الإنشاء حفاظًا على الروابط."}
          </span>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="s-desc">الوصف</Label>
          <Textarea id="s-desc" name="description" defaultValue={editing?.description} rows={3} maxLength={600} placeholder="سطران عن فكرة البرنامج" />
          {editing?.storyId ? <span className="text-[11px] text-muted-foreground">فارغ = يُعرض ملخص مادة البرنامج القديمة.</span> : null}
        </div>

        <div className="flex gap-4">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">الغلاف</span>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="relative grid size-28 place-items-center overflow-hidden rounded-lg border-2 border-dashed border-input bg-muted/30 text-[11px] text-muted-foreground hover:border-foreground/40"
              aria-label={cover ? "تغيير الغلاف" : "رفع الغلاف"}
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- معاينة داخل اللوحة لملف رُفع للتو.
                <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="grid place-items-center gap-1">
                  <UploadCloudIcon className="size-5" />
                  {uploading ? "يُرفع…" : "مربع 1400×1400"}
                </span>
              )}
            </button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadCover(event.target.files?.[0])} />
          </div>
          <div className="grid flex-1 content-start gap-1.5">
            <span className="text-sm font-medium">لون البرنامج</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="لون البرنامج">
              {swatches.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={accent === color}
                  aria-label={color === suggested ? `${color} (من الغلاف)` : color}
                  onClick={() => setAccent(color)}
                  className={cn("size-8 rounded-md", accent === color && "outline-2 outline-offset-2 outline-foreground")}
                  style={{ background: color }}
                />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">يُقترح تلقائيًا من الغلاف. للمشغل والبطاقات.</span>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="s-feed">خلاصة RSS</Label>
          <Input id="s-feed" name="feedUrl" type="url" dir="ltr" defaultValue={editing?.feedUrl ?? ""} placeholder="https://media.rss.com/…/feed.xml" />
          <span className="text-[11px] text-muted-foreground">اختياري. إن وُجدت تُدمج حلقاتها تلقائيًا مع الحلقات المرفوعة.</span>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="s-yt">قناة يوتيوب</Label>
          <Input id="s-yt" name="youtube" type="url" dir="ltr" defaultValue={editing?.youtube ?? ALELM_YOUTUBE} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 p-3">
          <span className="grid gap-0.5">
            <Label htmlFor="s-visible">ظاهر في الموقع</Label>
            <span className="text-[11px] text-muted-foreground">أطفئه لتجهيز البرنامج وحلقاته قبل الإعلان</span>
          </span>
          <Switch id="s-visible" checked={visible} onCheckedChange={setVisible} />
        </div>
      </div>

      <SheetFooter className="sticky bottom-0 flex-row gap-2 border-t border-border/70 bg-background p-4">
        <Button type="submit" disabled={busy || uploading}>{editing ? "حفظ" : "إضافة البرنامج"}</Button>
      </SheetFooter>
    </form>
  );
}
