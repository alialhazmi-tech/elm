"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STYLES: Array<{ key: string; name: string; desc: string; swatch: string }> = [
  { key: "real", name: "حقيقي", desc: "لقطة واقعية بعدسة صحفية — للأخبار الميدانية والتقارير", swatch: "linear-gradient(135deg,#0b1a33,#3d7ef7)" },
  { key: "illustrative", name: "توضيحي", desc: "مشهد فني يشرح الفكرة — للتحليلات و«افهمها صح» و«لماذا»", swatch: "linear-gradient(135deg,#14a8d6,#8b5cf6)" },
  { key: "graphic", name: "رسومي", desc: "مسطح أيقوني بألوان الهوية — للإنفوجرافيك و«بالأرقام»", swatch: "linear-gradient(135deg,#f5b92e,#f26a1b)" },
];

const SIZES: Array<[string, string]> = [
  ["cover", "غلاف 16:9"],
  ["square", "مربع 1:1"],
  ["portrait", "عمودي 9:16"],
];

export function AiImagesClient({ imagesEnabled, keyReady }: { imagesEnabled: boolean; keyReady: boolean }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("real");
  const [size, setSize] = useState("cover");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Array<{ id: string; url: string }>>([]);

  async function generate() {
    if (busy || !prompt.trim()) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/tahrir/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, style, size }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError(data?.error ?? "تعذر التوليد.");
      return;
    }
    setResults(data.images ?? []);
    router.refresh();
  }

  const blocked = !imagesEnabled || !keyReady;

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[1.2fr_1fr]">
      <Card className="gap-4 p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="img-prompt">وصف الصورة — بالعربية، وسيُضاف نمط الهوية تلقائيًا</Label>
          <Textarea
            id="img-prompt"
            rows={4}
            placeholder="مثال: ناقلة نفط عملاقة تعبر مضيق هرمز عند الغروب — بلا نصوص داخل الصورة."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {STYLES.map((item) => {
            const active = style === item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={active}
                onClick={() => setStyle(item.key)}
                className={cn(
                  "grid gap-1.5 rounded-lg border bg-card p-2.5 text-start transition-colors hover:bg-accent",
                  active && "border-primary ring-2 ring-primary/40",
                )}
              >
                <span className="h-10 rounded-md" style={{ background: item.swatch }} />
                <span className="font-display text-xs font-bold">{item.name}</span>
                <span className="text-[10.5px] leading-relaxed text-muted-foreground">{item.desc}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SIZES.map(([key, label]) => (
            <Button key={key} size="xs" variant={size === key ? "default" : "outline"} onClick={() => setSize(key)}>
              {label}
            </Button>
          ))}
        </div>
        <Button onClick={generate} disabled={busy || blocked || !prompt.trim()} className="justify-self-start font-display font-bold">
          <SparklesIcon data-icon="inline-start" />
          {busy ? "جارٍ التوليد…" : "ولّد صورتين"}
        </Button>
        {blocked ? (
          <Alert variant="destructive">
            <AlertDescription>
              {!keyReady ? "مفتاح مزود الصور غير مضبوط — أضف GEMINI_API_KEY ثم أعد التشغيل." : "توليد الصور معطل من إعدادات الذكاء."}
            </AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
          <b className="text-foreground">سياسة الصور المولدة:</b> لا توليد لوجوه شخصيات حقيقية (يمنعه المزود بإعداد صريح) · كل صورة توسم
          «مولّدة بالذكاء» بشفافية · حقوقها داخلية فتوثق تلقائيًا في المكتبة.
        </p>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="border-b px-4 py-3 font-display text-[13.5px] font-bold">النتائج</div>
        {results.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">الصور المولدة تظهر هنا وتُحفظ في المكتبة.</div>
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            {results.map((image) => (
              <div key={image.id} className="grid gap-2 overflow-hidden rounded-lg border">
                {/* عرض الأصل المولّد كما حُفظ */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="صورة مولدة بالذكاء" className="aspect-video w-full object-cover" />
                <div className="flex items-center gap-2 px-2 pb-2">
                  <span className="text-[10.5px] text-muted-foreground">✦ مولّدة بالذكاء</span>
                  <Button
                    size="xs"
                    variant="outline"
                    className="ms-auto"
                    onClick={() => {
                      void navigator.clipboard.writeText(image.url);
                      toast.success("نُسخ الرابط — الصقه في صورة المادة.");
                    }}
                  >
                    <CopyIcon data-icon="inline-start" />
                    انسخ الرابط
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
