"use client";

import { useEffect, useRef, useState } from "react";
import { CrosshairIcon, ScanFaceIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatImageFocus, imageFocusStyle, parseImageFocus } from "@/lib/content/image-focus";
import { detectImageFocus } from "@/lib/tahrir/client/image-focus-detect";
import { cn } from "@/lib/utils";

type Status = "idle" | "saved" | "detecting" | "auto" | "no-face" | "manual" | "failed";

const STATUS_TEXT: Record<Status, string> = {
  idle: "انقر على موضع الوجه أو العنصر الأهم ليبقى ظاهرًا حين تُقصّ الصورة.",
  saved: "نقطة التركيز محفوظة. انقر على الصورة لتعديلها.",
  detecting: "يبحث عن الوجوه في الصورة…",
  auto: "حُدّدت نقطة التركيز على الوجه تلقائيًا. انقر على الصورة لتعديلها.",
  "no-face": "لم يُعثر على وجه واضح؛ يبقى القص من المنتصف. انقر لتحديد النقطة يدويًا.",
  manual: "حُدّدت نقطة التركيز يدويًا.",
  failed: "تعذر تحليل الصورة؛ يبقى القص من المنتصف. يمكنك تحديد النقطة بالنقر.",
};

/** الإطارات كما تقصّها الواجهة: الصدارة طولية (416×655)، البطاقة 16:10، والمصغّرة مربعة. */
const FRAMES = [
  { label: "الصدارة", className: "w-12 aspect-[416/655]" },
  { label: "البطاقة", className: "w-24 aspect-[16/10]" },
  { label: "المصغّرة", className: "w-12 aspect-square" },
];

const STEP = 5;

export function ImageFocusPicker({ image, focus, autoDetect, onFocus }: {
  image: string;
  /** "س% ص%" أو "" للمنتصف. */
  focus: string;
  /** الإنفوجرافيك لا يُكشف تلقائيًا: نقل القص إلى وجه فيه يقطع عنوانه. */
  autoDetect: boolean;
  onFocus: (value: string) => void;
}) {
  const [status, setStatus] = useState<Status>(focus ? "saved" : "idle");
  const point = parseImageFocus(focus);
  const shownImage = useRef(image);
  const focusRef = useRef(focus);
  useEffect(() => { focusRef.current = focus; }, [focus]);

  async function detect(target: string) {
    setStatus("detecting");
    try {
      const result = await detectImageFocus(target);
      // صورة أخرى اختيرت أثناء التحليل: النتيجة لم تعد لها.
      if (shownImage.current !== target) return;
      onFocus(result.focus ?? "");
      setStatus(result.focus ? "auto" : "no-face");
    } catch {
      if (shownImage.current === target) setStatus("failed");
    }
  }

  // صورة جديدة (رفع أو مكتبة أو رابط) تُكشف تلقائيًا بعد توقف الكتابة؛ صورة المادة
  // عند فتحها لا تُمس حتى لا يصبح المحرر «معدّلًا» بلا فعل من المحرر.
  useEffect(() => {
    if (shownImage.current === image) return;
    shownImage.current = image;
    setStatus("idle");
    if (!image || !autoDetect) return;
    const timer = window.setTimeout(() => {
      // نقطة استعيدت مع مسودة محلية تبقى كما هي.
      if (!focusRef.current) void detect(image);
    }, 600);
    return () => window.clearTimeout(timer);
    // detect يقرأ المراجع؛ الإطلاق مربوط بتغيّر الصورة وحدها.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, autoDetect]);

  function place(x: number, y: number) {
    const value = formatImageFocus({ x, y });
    onFocus(value === "50% 50%" ? "" : value);
    setStatus("manual");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const current = point ?? { x: 50, y: 50 };
    // الأسهم بصريًا: اليسار يُنقص س أيًّا كان اتجاه الصفحة.
    const moves: Record<string, [number, number]> = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    place(Math.min(100, Math.max(0, current.x + move[0])), Math.min(100, Math.max(0, current.y + move[1])));
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        className="relative block w-full cursor-crosshair overflow-hidden rounded-md border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label={`نقطة تركيز الصورة: ${point ? `${point.x}% أفقيًا و${point.y}% رأسيًا` : "المنتصف"}. انقر لتحديدها أو استخدم الأسهم.`}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          place(((event.clientX - box.left) / box.width) * 100, ((event.clientY - box.top) / box.height) * 100);
        }}
        onKeyDown={onKeyDown}
      >
        {/* الصورة كاملة بلا قص حتى يرى المحرر ما سيُقصّ منها. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="معاينة صورة المادة" className="block h-auto max-h-72 w-full object-contain" />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-[0_0_0_1px_rgb(0_0_0/0.35)]",
            !point && "opacity-50",
          )}
          style={{ left: `${point?.x ?? 50}%`, top: `${point?.y ?? 50}%` }}
        />
      </button>

      <div className="flex items-end gap-2" aria-label="معاينة القص">
        {FRAMES.map((frame) => (
          <figure key={frame.label} className="grid justify-items-center gap-1">
            <span className={cn("block overflow-hidden rounded-sm border bg-muted", frame.className)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="size-full object-cover" style={imageFocusStyle(focus)} />
            </span>
            <figcaption className="text-[10px] text-muted-foreground">{frame.label}</figcaption>
          </figure>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="xs" variant="outline" onClick={() => void detect(image)} disabled={status === "detecting"}>
          <ScanFaceIcon data-icon="inline-start" />
          {status === "detecting" ? "يحلّل…" : "كشف الوجه"}
        </Button>
        {focus ? (
          <Button size="xs" variant="ghost" onClick={() => { onFocus(""); setStatus("idle"); }}>
            <CrosshairIcon data-icon="inline-start" />
            توسيط
          </Button>
        ) : null}
      </div>
      <div role="status" className="text-[11px] leading-5 text-muted-foreground">{STATUS_TEXT[status]}</div>
    </div>
  );
}
