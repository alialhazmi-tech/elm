"use client";

/**
 * محرر «جاك العلم» — من لصق التقرير إلى شرائح جاهزة للاعتماد.
 * الذكاء يقترح الخطة والعمليات محددة النطاق؛ كل قرار تطبيق بيد المحرر،
 * والنشر يمر بمسارات المواد الحالية نفسها (الحارس والأدوار كما هي).
 * المنطق كما كان منذ المرحلة الأولى؛ الواجهة على shadcn.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  FileDownIcon,
  GripVerticalIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";

import type { JakCanvas, JakSlide, ReportPalette, ReportTemplate, SlideType } from "@/lib/tahrir/jak";
import {
  imageGenerationPrompt,
  imageGenerationSize,
  isLandscapeReport,
  paletteOf,
  reportLayoutIssues,
  REPORT_PALETTES,
  REPORT_TEMPLATE_NAMES,
  REPORT_TEMPLATES,
  SLIDE_TYPE_NAMES,
  SLIDE_TYPES,
} from "@/lib/tahrir/jak";

import { JakStory } from "@/app/_components/jak-slides";
import { JakReport } from "@/app/_components/jak-report";
import { GuardChip, StatusPill } from "@/components/tahrir/badges";
import { SelectField } from "@/components/tahrir/select-field";
import { ArchiveDialog, ConfirmDialog, type StoryAction } from "@/components/tahrir/stories/story-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SlideGuard {
  ok: boolean;
  findings: Array<{ ruleId: string; severity: string; message: string }>;
}
type EditorSlide = JakSlide & { guard?: SlideGuard };

interface Props {
  /** يملك الاعتماد والنشر (story.publish) — يُحلّ على الخادم. */
  canApprove: boolean;
  sections: Array<[string, string]>;
  recentMedia: Array<{ url: string; filename: string }>;
  initial: {
    id: string;
    title: string;
    excerpt: string;
    section: string;
    slug: string;
    status: string;
    slides: EditorSlide[];
    source: string;
    archiveEvent?: { at: string; actor: string; reason: string } | null;
  } | null;
}

const IMAGE_STYLES: Array<[string, string]> = [
  ["real", "حقيقي"],
  ["illustrative", "توضيحي"],
  ["graphic", "رسومي"],
];

const AI_OPS: Array<[string, string]> = [
  ["retitle", "عنوان بديل"],
  ["shorten", "اختصر"],
  ["rebuild", "أعد بناءها"],
  ["to_stat", "لرقمية"],
  ["split", "قسّمها"],
];

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  review: "بانتظار الاعتماد",
  scheduled: "مجدول",
  published: "منشور",
  archived: "مؤرشفة",
};

const blankSlide = (
  type: SlideType = "text",
  canvas: JakCanvas = "vertical",
  template: ReportTemplate = type === "hero" ? "cover" : "image-text",
): EditorSlide => ({
  id: crypto.randomUUID(),
  type,
  title: "",
  body: "",
  stat: "",
  statLabel: "",
  image: null,
  imageStyle: "real",
  imagePrompt: "",
  sourceContext: "",
  hidden: false,
  data: canvas === "landscape" ? { canvas, template, focalPoint: "left", textSafeArea: "right" } : null,
});

/** حقل بعنوان صغير فوقه — لكثافة حقول الشريحة. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-[10.5px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

const MessageAlert = ({ message }: { message: { kind: "ok" | "err"; text: string } | null }) =>
  message ? (
    <Alert variant={message.kind === "err" ? "destructive" : "default"}>
      <AlertDescription>{message.text}</AlertDescription>
    </Alert>
  ) : null;

export function JakEditor({ canApprove, sections, recentMedia, initial }: Props) {
  const router = useRouter();
  const [id, setId] = useState(initial?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [section, setSection] = useState(initial?.section ?? "current-events");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [archiveEvent, setArchiveEvent] = useState(initial?.archiveEvent ?? null);
  const [source, setSource] = useState(initial?.source ?? "");
  const [slides, setSlides] = useState<EditorSlide[]>(initial?.slides ?? []);
  const [canvas, setCanvas] = useState<JakCanvas>(
    initial && isLandscapeReport(initial.slides) ? "landscape" : "vertical",
  );
  const [dropped, setDropped] = useState<Array<{ title: string; reason: string }>>([]);
  const [phase, setPhase] = useState<"source" | "analyzing" | "slides">(
    initial && initial.slides.length > 0 ? "slides" : "source",
  );
  const [openSlide, setOpenSlide] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [imageProgress, setImageProgress] = useState<{ done: number; total: number } | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [blockers, setBlockers] = useState<Array<{ ruleId: string; message: string; excerpt?: string }>>([]);
  const [action, setAction] = useState<StoryAction | null>(null);

  const err = (text: string) => setMessage({ kind: "err", text });
  const ok = (text: string) => setMessage({ kind: "ok", text });

  // الروابط التي سُجلت قبل تفعيل المخزن لا تملك ملفات فعلية؛ أعدها تلقائيًا إلى قائمة التوليد.
  useEffect(() => {
    const candidates = (initial?.slides ?? []).filter((slide) => slide.image?.startsWith("/uploads/"));
    if (candidates.length === 0) return;
    let cancelled = false;

    Promise.all(
      candidates.map(async (slide) => {
        const response = await fetch(slide.image!, { method: "HEAD", cache: "no-store" }).catch(() => null);
        return response?.status === 404 ? slide.id : null;
      }),
    ).then((results) => {
      if (cancelled) return;
      const missing = new Set(results.filter((slideId): slideId is string => Boolean(slideId)));
      if (missing.size === 0) return;
      setSlides((current) => current.map((slide) => (missing.has(slide.id) ? { ...slide, image: null } : slide)));
      setMessage({ kind: "err", text: `اكتُشف ${missing.size} رابط صورة قديم مفقود — أصبح جاهزًا لإعادة التوليد.` });
    });

    return () => {
      cancelled = true;
    };
  }, [initial]);

  /* ============ التحليل ============ */

  async function analyze(targetCanvas: JakCanvas = canvas) {
    setCanvas(targetCanvas);
    setPhase("analyzing");
    setMessage(null);
    const response = await fetch("/api/tahrir/jak/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, source, canvas: targetCanvas }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!response?.ok || !data?.plan) {
      setPhase("source");
      err(data?.error ?? "تعذر التحليل.");
      return;
    }
    if (!title && data.plan.title) setTitle(data.plan.title);
    if (data.plan.excerpt) setExcerpt(data.plan.excerpt);
    setSlides(data.plan.slides);
    setDropped(data.plan.dropped ?? []);
    setPhase("slides");
    ok(`اقترح التحليل ${data.plan.slides.length} شريحة — راجع وعدّل ثم احفظ.`);
  }

  /* ============ عمليات الشرائح ============ */

  const patch = (slideId: string, partial: Partial<EditorSlide>) =>
    setSlides((current) => current.map((slide) => (slide.id === slideId ? { ...slide, ...partial } : slide)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    setSlides(next);
  };

  const insertAfter = (index: number) => {
    const next = [...slides];
    next.splice(index + 1, 0, blankSlide("text", canvas));
    setSlides(next);
    setOpenSlide(next[index + 1].id);
  };

  const duplicate = (index: number) => {
    const next = [...slides];
    next.splice(index + 1, 0, { ...slides[index], id: crypto.randomUUID() });
    setSlides(next);
  };

  async function slideOp(index: number, op: string) {
    const slide = slides[index];
    setAiBusy(`${slide.id}:${op}`);
    setMessage(null);
    const response = await fetch("/api/tahrir/jak/slide-op", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, slide, source }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setAiBusy(null);
    if (!response?.ok || !data?.slides?.length) {
      err(data?.error ?? "تعذرت العملية.");
      return;
    }
    const next = [...slides];
    next.splice(index, 1, ...(data.slides as EditorSlide[]).map((item) => ({
      ...item,
      image: slide.image,
      data: slide.data?.canvas === "landscape"
        ? { ...item.data, ...slide.data, blocks: item.data?.blocks ?? slide.data.blocks }
        : item.data,
    })));
    if (op === "split" && data.slides.length > 1) next[index + 1].image = null;
    setSlides(next);
    ok("طُبّق المقترح — القرار النهائي عند الحفظ.");
  }

  async function requestGeneratedImage(slide: EditorSlide): Promise<string> {
    const response = await fetch("/api/tahrir/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: imageGenerationPrompt(slide),
        style: slide.imageStyle ?? "real",
        size: imageGenerationSize(slide),
        count: 1,
      }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!response?.ok || !data?.images?.[0]?.url) {
      throw new Error(data?.error ?? "تعذر توليد الصورة التحريرية.");
    }
    return data.images[0].url as string;
  }

  async function generateImage(index: number) {
    const slide = slides[index];
    if (!slide.imagePrompt.trim()) {
      err("اكتب وصف الصورة التحريرية أولًا (imagePrompt).");
      return;
    }
    setAiBusy(`${slide.id}:image`);
    setMessage(null);
    try {
      const image = await requestGeneratedImage(slide);
      patch(slide.id, { image });
      ok("وُلّدت الصورة التحريرية ودخلت المكتبة موثقة الحقوق.");
    } catch (error) {
      err(error instanceof Error ? error.message : "تعذر توليد الصورة التحريرية.");
    } finally {
      setAiBusy(null);
    }
  }

  async function generateReportImages() {
    const pending = slides.filter((slide) =>
      slide.data?.canvas === "landscape" && !slide.hidden && !slide.image && slide.imagePrompt.trim(),
    );
    if (pending.length === 0) {
      ok("كل صفحات التقرير التي تحمل وصفًا بصريًا لديها صور بالفعل.");
      return;
    }

    setAiBusy("report-images");
    setImageProgress({ done: 0, total: pending.length });
    setMessage(null);
    let generated = 0;
    const failures: string[] = [];

    for (const slide of pending) {
      try {
        const image = await requestGeneratedImage(slide);
        patch(slide.id, { image });
        generated += 1;
      } catch (error) {
        const failure = error instanceof Error ? error.message : "تعذر توليد صورة.";
        failures.push(failure);
        // أخطاء النموذج/المفتاح لن تتغير بين الصفحات؛ أوقف الدفعة لتجنب تكرار طلب فاشل.
        if (/\b(400|401|403|404)\b|not found|API key|النموذج|المفتاح/i.test(failure)) break;
      }
      setImageProgress({ done: generated + failures.length, total: pending.length });
    }

    setAiBusy(null);
    setImageProgress(null);
    if (failures.length > 0) {
      err(`وُلّدت ${generated} من ${pending.length} صورة. ${failures[0]}`);
    } else {
      ok(`وُلّدت ${generated} صورة 16:9 وأضيفت إلى صفحات التقرير.`);
    }
  }

  /* ============ الحفظ والنشر ============ */

  async function save(): Promise<string | null> {
    if (!title.trim()) {
      err("العنوان مطلوب.");
      return null;
    }
    setBusy(true);
    setMessage(null);

    const storyResponse = await fetch("/api/tahrir/story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: id || undefined,
        title,
        excerpt,
        body: "",
        section,
        slug: initial?.slug || "",
        seriesSlug: null,
        image: slides.find((slide) => slide.image)?.image ?? null,
        format: "jakalelm",
      }),
    }).catch(() => null);
    const storyData = await storyResponse?.json().catch(() => null);
    if (!storyResponse?.ok) {
      setBusy(false);
      err(storyData?.error ?? "تعذر حفظ المادة.");
      return null;
    }

    // ثبّت هوية المادة فور نجاح الصف الأم. إذا تعثر حفظ الشرائح لاحقًا،
    // تعيد المحاولة على السجل نفسه بدل إنشاء مسودة مكررة بمعرّف جديد.
    const savedStoryId = storyData.id as string;
    setId(savedStoryId);
    if (!id) router.replace(`/tahrir/jak/${savedStoryId}`);

    const slidesResponse = await fetch("/api/tahrir/jak/slides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId: savedStoryId, source, slides }),
    }).catch(() => null);
    const slidesData = await slidesResponse?.json().catch(() => null);
    setBusy(false);
    if (!slidesResponse?.ok) {
      err(slidesData?.error ?? "حُفظت المادة وتعذر حفظ الشرائح.");
      return null;
    }

    if (!initial) setStatus("draft");
    ok("حُفظ جاك العلم بشرائحه.");
    return savedStoryId;
  }

  async function workflow(route: "submit" | "publish", label: string) {
    const savedId = await save();
    if (!savedId) return;
    setBusy(true);
    const response = await fetch(`/api/tahrir/story/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: savedId }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      // الحارس يعيد نص كل مخالفة ومقتطفها — تُعرض للمحرر ليعرف ما يصلح
      setBlockers(Array.isArray(data?.findings) ? data.findings : []);
      err(data?.error ?? `تعذر ${label}.`);
      return;
    }
    setBlockers([]);
    setStatus(route === "publish" ? "published" : "review");
    ok(route === "publish" ? "نُشر جاك العلم على الموقع." : "أُرسل للاعتماد — القرار بشري.");
    router.refresh();
  }

  async function schedule() {
    if (!scheduleAt) {
      err("اختر موعد الجدولة أولًا.");
      return;
    }
    const savedId = await save();
    if (!savedId) return;
    setBusy(true);
    const response = await fetch("/api/tahrir/story/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: savedId, scheduledAt: new Date(scheduleAt).toISOString() }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setBlockers(Array.isArray(data?.findings) ? data.findings : []);
      err(data?.error ?? "تعذرت الجدولة.");
      return;
    }
    setBlockers([]);
    setStatus("scheduled");
    ok("جُدول — الحارس يفحصه ثانية لحظة الموعد.");
  }

  function exportReport() {
    if (!isLandscapeReport(slides)) {
      err("التصدير الأفقي متاح للتقرير البصري 16:9 فقط.");
      return;
    }
    document.documentElement.classList.add("jak-print-report");
    window.addEventListener(
      "afterprint",
      () => document.documentElement.classList.remove("jak-print-report"),
      { once: true },
    );
    window.print();
    window.setTimeout(() => document.documentElement.classList.remove("jak-print-report"), 1500);
  }

  /* ============ العرض ============ */

  const sectionName = sections.find(([slug]) => slug === section)?.[1] ?? section;
  const sectionOptions = sections.map(([slug, name]) => ({ value: slug, label: name }));
  const landscape = isLandscapeReport(slides);
  const pendingImages = slides.filter((slide) => slide.data?.canvas === "landscape" && !slide.hidden && !slide.image && slide.imagePrompt.trim()).length;

  if (phase !== "slides") {
    return (
      <Card className="mx-auto w-full max-w-3xl gap-4 p-5">
        <div className="grid gap-1.5">
          <Label htmlFor="jak-title">العنوان (اختياري — يقترحه التحليل إن تُرك)</Label>
          <Input id="jak-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان جاك العلم…" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="jak-source">التقرير المصدر</Label>
          <Textarea
            id="jak-source"
            rows={10}
            className="leading-loose"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="الصق التقرير النصي الكامل هنا…"
          />
        </div>
        {phase === "analyzing" ? (
          <div className="th-ai-shimmer rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            ✦ يقرأ المصدر ويستخرج وحدات السرد ويبني الخطة ويفحصها بالحارس… لم يُحفظ ولم يُنشر شيء.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <Button onClick={() => analyze("vertical")} disabled={!source.trim()} className="font-display font-bold">
              <SparklesIcon data-icon="inline-start" />
              حوّل إلى جاك العلم
            </Button>
            <Button variant="secondary" onClick={() => analyze("landscape")} disabled={!source.trim()}>
              <SparklesIcon data-icon="inline-start" />
              أنشئ تقريرًا بصريًا 16:9
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCanvas("vertical");
                setSlides([blankSlide("hero"), blankSlide(), blankSlide("end")]);
                setPhase("slides");
              }}
            >
              أو ابدأ بشرائح فارغة يدويًا
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCanvas("landscape");
                setSlides([
                  blankSlide("hero", "landscape", "cover"),
                  blankSlide("text", "landscape", "image-text"),
                  blankSlide("stat", "landscape", "stats"),
                  blankSlide("list", "landscape", "grid"),
                ]);
                setPhase("slides");
              }}
            >
              أو ابدأ بتقرير أفقي فارغ
            </Button>
          </div>
        )}
        <MessageAlert message={message} />
        <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
          <b className="text-foreground">الحوكمة:</b> التحليل اقتراح يُفحص بالحارس ومدقق الأرقام قبل عرضه · أي رقم غير موجود في
          المصدر يُرفض آليًا · <b className="text-foreground">لا ينشر الذكاء شيئًا — الاعتماد بشري دائمًا.</b>
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="gap-3 p-4">
        <Textarea
          rows={1}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="عنوان جاك العلم…"
          aria-label="عنوان جاك العلم"
          className="min-h-0 resize-none rounded-none border-0 bg-transparent px-0 py-1 font-display text-[20px] leading-snug font-extrabold shadow-none focus-visible:ring-0 md:text-[20px] dark:bg-transparent"
        />
        <div className="flex flex-wrap items-center gap-2">
          <SelectField value={section} onValueChange={setSection} options={sectionOptions} ariaLabel="القسم" className="w-40" />
          <StatusPill status={status} label={STATUS_LABELS[status] ?? status} />
          {landscape ? <span className="rounded-md bg-muted px-2 py-0.5 text-[11px]">▭ تقرير 16:9</span> : null}
          {landscape ? (
            <SelectField
              ariaLabel="طابع التقرير اللوني"
              value={paletteOf(slides)}
              onValueChange={(value) => {
                const palette = value as ReportPalette;
                setSlides(slides.map((slide) => ({ ...slide, data: { ...slide.data, palette } })));
              }}
              options={Object.entries(REPORT_PALETTES).map(([key, item]) => ({ value: key, label: `🎨 ${item.name}` }))}
              className="w-44"
            />
          ) : null}
          <div className="ms-auto flex flex-wrap gap-1.5">
            {landscape ? (
              <Button size="sm" variant="outline" onClick={generateReportImages} disabled={aiBusy !== null}>
                <SparklesIcon data-icon="inline-start" />
                {aiBusy === "report-images" && imageProgress
                  ? `توليد الصور ${imageProgress.done}/${imageProgress.total}`
                  : `ولّد صور التقرير (${pendingImages})`}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setPreview(!preview)}>
              {preview ? <EyeOffIcon data-icon="inline-start" /> : <EyeIcon data-icon="inline-start" />}
              {preview ? "أغلق المعاينة" : landscape ? "معاينة التقرير" : "معاينة جاك العلم"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPhase("source")}>
              المصدر
            </Button>
            {landscape ? (
              <Button size="sm" variant="outline" onClick={exportReport}>
                <FileDownIcon data-icon="inline-start" />
                تصدير PDF
              </Button>
            ) : null}
          </div>
        </div>
        {dropped.length > 0 ? (
          <Alert variant="destructive">
            <AlertDescription>
              أسقط مدقق الأرقام {dropped.length} شريحة: {dropped.map((item) => `«${item.title}» (${item.reason})`).join(" · ")}
            </AlertDescription>
          </Alert>
        ) : null}
        <MessageAlert message={message} />
        {blockers.length > 0 ? (
          <ul className="grid gap-1.5 rounded-md bg-(--t-block-bg) p-3 text-xs text-(--t-block)">
            {blockers.map((blocker, index) => (
              <li key={`${blocker.ruleId}-${index}`} className="grid gap-0.5">
                <b className="font-display text-[10.5px]">{blocker.ruleId}</b>
                <span>{blocker.message}</span>
                {blocker.excerpt ? <em className="text-[11px] opacity-80">«{blocker.excerpt}»</em> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3">
          {slides.map((slide, index) => {
            const open = openSlide === slide.id;
            return (
              <Card key={slide.id} className={cn("gap-0 overflow-hidden py-0", slide.hidden && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <GripVerticalIcon className="size-4 text-muted-foreground" />
                  <SelectField
                    ariaLabel="نوع الشريحة"
                    value={slide.type}
                    onValueChange={(value) => patch(slide.id, { type: value as SlideType })}
                    options={SLIDE_TYPES.map((type) => ({ value: type, label: SLIDE_TYPE_NAMES[type] }))}
                    className="h-7 w-32 text-xs"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                    {slide.title || slide.stat || slide.body.slice(0, 40) || "شريحة فارغة"}
                  </span>
                  {slide.guard && !slide.guard.ok ? <GuardChip tone="block" label="مخالفة" /> : null}
                  {slide.hidden ? <GuardChip tone="warn" label="مخفية" /> : null}
                  <Button size="xs" variant={open ? "secondary" : "outline"} onClick={() => setOpenSlide(open ? null : slide.id)}>
                    {open ? "أغلق" : "تحرير"}
                  </Button>
                </div>

                {open ? (
                  <div className="grid gap-3 border-t bg-muted/30 p-3">
                    {slide.data?.canvas === "landscape" ? (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <SelectField
                            ariaLabel="قالب الصفحة"
                            value={slide.data.template ?? "image-text"}
                            onValueChange={(value) => patch(slide.id, { data: { ...slide.data, template: value as ReportTemplate } })}
                            options={REPORT_TEMPLATES.map((template) => ({ value: template, label: REPORT_TEMPLATE_NAMES[template] }))}
                          />
                          <Input
                            placeholder="التصنيف القصير: بالأرقام"
                            value={slide.data.eyebrow ?? ""}
                            onChange={(event) => patch(slide.id, { data: { ...slide.data, eyebrow: event.target.value } })}
                          />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <SelectField
                            ariaLabel="موضع العنصر البصري"
                            value={slide.data.focalPoint ?? "left"}
                            onValueChange={(value) => patch(slide.id, { data: { ...slide.data, focalPoint: value as "left" | "center" | "right" } })}
                            options={[
                              { value: "left", label: "العنصر البصري يسار" },
                              { value: "center", label: "العنصر البصري وسط" },
                              { value: "right", label: "العنصر البصري يمين" },
                            ]}
                          />
                          <SelectField
                            ariaLabel="مساحة النص"
                            value={slide.data.textSafeArea ?? "right"}
                            onValueChange={(value) => patch(slide.id, { data: { ...slide.data, textSafeArea: value as "left" | "center" | "right" } })}
                            options={[
                              { value: "right", label: "مساحة النص يمين" },
                              { value: "center", label: "مساحة النص وسط" },
                              { value: "left", label: "مساحة النص يسار" },
                            ]}
                          />
                        </div>
                      </>
                    ) : null}
                    <Input placeholder="عنوان الشريحة (≤10 كلمات)" value={slide.title} onChange={(event) => patch(slide.id, { title: event.target.value })} />
                    <Textarea rows={2} placeholder="نص الشريحة — جملة أو جملتان" value={slide.body} onChange={(event) => patch(slide.id, { body: event.target.value })} />

                    {slide.type === "stat" ? (
                      <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                        <Input dir="ltr" placeholder="73%" value={slide.stat} onChange={(event) => patch(slide.id, { stat: event.target.value })} />
                        <Input placeholder="تفسير الرقم في سطر" value={slide.statLabel} onChange={(event) => patch(slide.id, { statLabel: event.target.value })} />
                      </div>
                    ) : null}

                    {slide.type === "comparison" ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[0, 1].map((sideIndex) => (
                          <div key={sideIndex} className="flex gap-1.5">
                            <Input
                              placeholder={sideIndex === 0 ? "الطرف الأول (2019)" : "الطرف الثاني (2026)"}
                              value={slide.data?.sides?.[sideIndex]?.label ?? ""}
                              onChange={(event) => {
                                const sides = [...(slide.data?.sides ?? [{ label: "", value: "" }, { label: "", value: "" }])];
                                sides[sideIndex] = { ...sides[sideIndex], label: event.target.value };
                                patch(slide.id, { data: { ...slide.data, sides } });
                              }}
                            />
                            <Input
                              dir="ltr"
                              className="w-24"
                              placeholder="القيمة"
                              value={slide.data?.sides?.[sideIndex]?.value ?? ""}
                              onChange={(event) => {
                                const sides = [...(slide.data?.sides ?? [{ label: "", value: "" }, { label: "", value: "" }])];
                                sides[sideIndex] = { ...sides[sideIndex], value: event.target.value };
                                patch(slide.id, { data: { ...slide.data, sides } });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {slide.type === "list" || slide.type === "summary" ? (
                      <Textarea
                        rows={3}
                        placeholder="عنصر في كل سطر"
                        value={(slide.data?.items ?? []).join("\n")}
                        onChange={(event) =>
                          patch(slide.id, {
                            data: { ...slide.data, items: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) },
                          })
                        }
                      />
                    ) : null}

                    {slide.data?.canvas === "landscape" && ["stats", "grid"].includes(slide.data.template ?? "") ? (
                      <Textarea
                        rows={4}
                        placeholder="وحدة في كل سطر: القيمة | الوحدة | العنوان | النص"
                        value={(slide.data.blocks ?? []).map((block) => `${block.value} | ${block.label} | ${block.title} | ${block.body}`).join("\n")}
                        onChange={(event) =>
                          patch(slide.id, {
                            data: {
                              ...slide.data,
                              blocks: event.target.value
                                .split("\n")
                                .map((line) => {
                                  const [value = "", label = "", blockTitle = "", body = ""] = line.split("|").map((part) => part.trim());
                                  return { value, label, title: blockTitle, body };
                                })
                                .filter((block) => block.value || block.title || block.body)
                                .slice(0, 6),
                            },
                          })
                        }
                      />
                    ) : null}

                    {slide.type === "timeline" ? (
                      <Textarea
                        rows={3}
                        placeholder="سطر لكل نقطة: السنة | العنوان | التفصيل"
                        value={(slide.data?.points ?? []).map((point) => `${point.year} | ${point.title} | ${point.detail}`).join("\n")}
                        onChange={(event) =>
                          patch(slide.id, {
                            data: {
                              ...slide.data,
                              points: event.target.value
                                .split("\n")
                                .map((line) => {
                                  const [year = "", pointTitle = "", detail = ""] = line.split("|").map((part) => part.trim());
                                  return { year, title: pointTitle, detail };
                                })
                                .filter((point) => point.title),
                            },
                          })
                        }
                      />
                    ) : null}

                    {slide.type === "quote" ? (
                      <Input
                        placeholder="نسبة الاقتباس — من قاله؟"
                        value={slide.data?.quoteBy ?? ""}
                        onChange={(event) => patch(slide.id, { data: { ...slide.data, quoteBy: event.target.value } })}
                      />
                    ) : null}

                    <Field label="الصورة التحريرية">
                      {slide.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slide.image}
                          alt=""
                          className="h-24 w-full rounded-md object-cover"
                          onError={() => {
                            patch(slide.id, { image: null });
                            err("رابط الصورة القديمة مفقود من المخزن — أعد توليد الصورة لهذه الصفحة.");
                          }}
                        />
                      ) : null}
                      <Input
                        dir="ltr"
                        placeholder="imagePrompt — atmospheric cinematic scene, navy and gold, no people, no text"
                        value={slide.imagePrompt}
                        onChange={(event) => patch(slide.id, { imagePrompt: event.target.value })}
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button size="xs" variant="outline" onClick={() => generateImage(index)} disabled={aiBusy !== null}>
                          <SparklesIcon data-icon="inline-start" />
                          {aiBusy === `${slide.id}:image` ? "يولّد…" : slide.image ? "أعد التوليد" : "ولّد الصورة"}
                        </Button>
                        {IMAGE_STYLES.map(([styleKey, styleName]) => (
                          <Button
                            key={styleKey}
                            size="xs"
                            variant={slide.imageStyle === styleKey ? "default" : "outline"}
                            onClick={() => patch(slide.id, { imageStyle: styleKey })}
                          >
                            {styleName}
                          </Button>
                        ))}
                        {slide.image ? (
                          <Button size="xs" variant="ghost" onClick={() => patch(slide.id, { image: null })}>
                            بلا صورة
                          </Button>
                        ) : null}
                      </div>
                      {recentMedia.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {recentMedia.map((item) => (
                            <button
                              key={item.url}
                              type="button"
                              title={item.filename}
                              onClick={() => patch(slide.id, { image: item.url })}
                              className={cn("h-8 w-11 overflow-hidden rounded-md border-2 border-transparent", slide.image === item.url && "border-primary")}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={item.url} alt={item.filename} className="size-full object-cover" />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </Field>

                    {slide.sourceContext ? (
                      <div className="rounded-md border-s-2 border-primary bg-card px-3 py-2 text-[11px] text-muted-foreground">من المصدر: «{slide.sourceContext}»</div>
                    ) : null}
                    {slide.guard && slide.guard.findings.length > 0 ? (
                      <div className="text-xs text-(--t-block)">{slide.guard.findings.slice(0, 2).map((finding) => finding.message).join(" · ")}</div>
                    ) : null}
                    {reportLayoutIssues(slide).length > 0 ? <div className="text-xs text-(--t-block)">{reportLayoutIssues(slide).join(" · ")}</div> : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-1 border-t px-2 py-1.5">
                  <Button size="icon-xs" variant="ghost" aria-label="لأعلى" onClick={() => move(index, -1)} disabled={index === 0}>
                    <ArrowUpIcon />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label="لأسفل" onClick={() => move(index, 1)} disabled={index === slides.length - 1}>
                    <ArrowDownIcon />
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => insertAfter(index)}>
                    <PlusIcon data-icon="inline-start" />
                    بعدها
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => duplicate(index)}>
                    <CopyIcon data-icon="inline-start" />
                    نسخ
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => patch(slide.id, { hidden: !slide.hidden })}>
                    {slide.hidden ? "إظهار" : "إخفاء"}
                  </Button>
                  <Button size="xs" variant="ghost" className="text-destructive" onClick={() => setSlides(slides.filter((item) => item.id !== slide.id))}>
                    <Trash2Icon data-icon="inline-start" />
                    حذف
                  </Button>
                  <span className="flex-1" />
                  {AI_OPS.map(([op, label]) => (
                    <Button key={op} size="xs" variant="outline" className="text-(--t-sug)" onClick={() => slideOp(index, op)} disabled={aiBusy === `${slide.id}:${op}`}>
                      <SparklesIcon data-icon="inline-start" />
                      {aiBusy === `${slide.id}:${op}` ? "…" : label}
                    </Button>
                  ))}
                </div>
              </Card>
            );
          })}
          <Button variant="outline" className="w-full" onClick={() => setSlides([...slides, blankSlide("text", canvas)])}>
            <PlusIcon data-icon="inline-start" />
            شريحة جديدة
          </Button>
        </div>

        <div className="grid gap-3 xl:sticky xl:top-[calc(var(--header-height)+0.5rem)]">
          {preview ? (
            <Card className="gap-1 overflow-hidden p-2">
              <div className={cn("mx-auto w-full overflow-auto rounded-lg border bg-black", landscape ? "aspect-video" : "max-h-[560px] max-w-[300px]")}>
                {landscape ? (
                  <JakReport meta={{ title, sectionName }} slides={slides} />
                ) : (
                  <JakStory
                    meta={{ title, sectionName, readingMinutes: Math.max(1, Math.round(slides.length / 3)), shareUrl: "https://alelm.net", next: null }}
                    slides={slides}
                  />
                )}
              </div>
              <div className="text-center text-[10px] text-muted-foreground">معاينة بجلستك فقط — لا رابط عامًا للمسودة.</div>
            </Card>
          ) : null}

          <Card className="gap-2 p-3">
            <div className="grid gap-1.5">
              <Button variant="outline" onClick={save} disabled={busy}>
                {status === "published" ? "تحديث المنشور" : "حفظ جاك العلم"}
              </Button>
              {status !== "published" && status !== "archived" ? (
                <Button variant="secondary" onClick={() => workflow("submit", "الإرسال")} disabled={busy}>
                  إرسال للاعتماد
                </Button>
              ) : null}
              {canApprove && status !== "published" && status !== "archived" ? (
                <Button className="font-display font-bold" onClick={() => workflow("publish", "النشر")} disabled={busy}>
                  اعتماد ونشر الآن
                </Button>
              ) : null}
              {canApprove && status !== "published" && status !== "archived" ? (
                <div className="flex gap-1.5">
                  <Input type="datetime-local" dir="ltr" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} aria-label="موعد الجدولة" className="min-w-0 flex-1" />
                  <Button variant="outline" onClick={schedule} disabled={busy}>
                    جدولة
                  </Button>
                </div>
              ) : null}
              {canApprove && status !== "draft" && status !== "archived" && initial?.id ? (
                <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => setAction({ kind: "archive", rows: [{ id: initial.id, title: title || "جاك العلم" }] })}>
                  <ArchiveIcon data-icon="inline-start" />
                  أرشفة المادة
                </Button>
              ) : null}
              {canApprove && status === "archived" && initial?.id ? (
                <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => setAction({ kind: "restore", rows: [{ id: initial.id, title: title || "جاك العلم" }] })}>
                  <ArchiveRestoreIcon data-icon="inline-start" />
                  استعادة كمسودة
                </Button>
              ) : null}
            </div>
            {status === "archived" && archiveEvent ? (
              <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                <b className="text-foreground">مؤرشف</b> — {archiveEvent.reason}
              </div>
            ) : null}
            <p className="border-t pt-2 text-[11px] leading-relaxed text-muted-foreground">
              النشر يمر بحارس السياسة (سطح بصري) وبنفس أدوار الاعتماد — لا مسار جانبيًا لجاك العلم.
            </p>
          </Card>

          <Card className="gap-1.5 p-3">
            <Label htmlFor="jak-excerpt">الموجز (≤180)</Label>
            <Textarea id="jak-excerpt" maxLength={220} rows={3} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} />
          </Card>
        </div>
      </div>

      <ArchiveDialog
        action={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          setStatus("archived");
          setArchiveEvent({ at: new Date().toISOString(), actor: "", reason: "أُرشفت من المحرر" });
        }}
      />
      <ConfirmDialog
        action={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          setStatus("draft");
          setArchiveEvent(null);
        }}
      />
    </div>
  );
}
