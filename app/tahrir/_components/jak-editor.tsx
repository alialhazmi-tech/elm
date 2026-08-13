"use client";

/**
 * محرر «جاك العلم» — من لصق التقرير إلى شرائح جاهزة للاعتماد.
 * الذكاء يقترح الخطة والعمليات محددة النطاق؛ كل قرار تطبيق بيد المحرر،
 * والنشر يمر بمسارات المواد الحالية نفسها (الحارس والأدوار كما هي).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
import { ArchiveStoryButton, RestoreStoryButton } from "./archive-controls";

interface SlideGuard {
  ok: boolean;
  findings: Array<{ ruleId: string; severity: string; message: string }>;
}
type EditorSlide = JakSlide & { guard?: SlideGuard };

interface Props {
  role: string;
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
  ["retitle", "✦ عنوان بديل"],
  ["shorten", "✦ اختصر"],
  ["rebuild", "✦ أعد بناءها"],
  ["to_stat", "✦ لرقمية"],
  ["split", "✦ قسّمها"],
];

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

export function JakEditor({ role, sections, recentMedia, initial }: Props) {
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

  const canApprove = role === "approver" || role === "chief";
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

  if (phase !== "slides") {
    return (
      <div className="th-panel" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="th-meta">
          <div className="lb">العنوان (اختياري — يقترحه التحليل إن تُرك)</div>
          <input
            className="th-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="عنوان جاك العلم…"
          />
        </div>
        <div className="th-meta">
          <div className="lb">التقرير المصدر</div>
          <textarea
            className="th-input"
            style={{ minHeight: 220, resize: "vertical", fontFamily: "inherit", lineHeight: 2 }}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="الصق التقرير النصي الكامل هنا…"
          />
        </div>
        <div className="th-actions">
          {phase === "analyzing" ? (
            <div className="th-ai-spin">
              ✦ يقرأ المصدر ويستخرج وحدات السرد ويبني الخطة ويفحصها بالحارس… لم يُحفظ ولم يُنشر شيء.
            </div>
          ) : (
            <>
              <button className="th-send ready" onClick={() => analyze("vertical")} disabled={!source.trim()}>
                ✦ حوّل إلى جاك العلم
              </button>
              <button className="th-send ready" onClick={() => analyze("landscape")} disabled={!source.trim()}>
                ✦ أنشئ تقريرًا بصريًا 16:9
              </button>
              <button
                className="th-save"
                onClick={() => {
                  setCanvas("vertical");
                  setSlides([blankSlide("hero"), blankSlide(), blankSlide("end")]);
                  setPhase("slides");
                }}
              >
                أو ابدأ بشرائح فارغة يدويًا
              </button>
              <button
                className="th-save"
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
              </button>
            </>
          )}
          {message && <div className={`th-msg ${message.kind}`}>{message.text}</div>}
        </div>
        <div className="th-ai-foot">
          <b>الحوكمة:</b> التحليل اقتراح يُفحص بالحارس ومدقق الأرقام قبل عرضه · أي رقم غير موجود في
          المصدر يُرفض آليًا · <b>لا ينشر الذكاء شيئًا — الاعتماد بشري دائمًا.</b>
        </div>
      </div>
    );
  }

  return (
    <div className="th-jak">
      <div className="th-jak-head th-panel">
        <input
          className="th-ed-title"
          style={{ fontSize: 19, padding: "12px 16px 0" }}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="عنوان جاك العلم…"
        />
        <div className="th-jak-bar">
          <select className="th-input" style={{ width: "auto" }} value={section} onChange={(event) => setSection(event.target.value)}>
            {sections.map(([slug, name]) => (
              <option key={slug} value={slug}>{name}</option>
            ))}
          </select>
          <span className={`th-pill ${status === "published" ? "pub" : status === "review" ? "rev" : status === "scheduled" ? "sch" : status === "archived" ? "arc" : "dft"}`}>
            {status === "published" ? "منشور" : status === "review" ? "بانتظار الاعتماد" : status === "scheduled" ? "مجدول" : status === "archived" ? "مؤرشفة" : "مسودة"}
          </span>
          {isLandscapeReport(slides) && <span className="th-report-badge">▭ تقرير 16:9</span>}
          {isLandscapeReport(slides) && (
            <select
              className="th-input"
              style={{ width: "auto" }}
              aria-label="طابع التقرير اللوني"
              value={paletteOf(slides)}
              onChange={(event) => {
                const palette = event.target.value as ReportPalette;
                setSlides(slides.map((slide) => ({ ...slide, data: { ...slide.data, palette } })));
              }}
            >
              {Object.entries(REPORT_PALETTES).map(([key, item]) => (
                <option key={key} value={key}>🎨 {item.name}</option>
              ))}
            </select>
          )}
          {isLandscapeReport(slides) && (
            <button className="th-mini" onClick={generateReportImages} disabled={aiBusy !== null}>
              {aiBusy === "report-images" && imageProgress
                ? `✦ توليد الصور ${imageProgress.done}/${imageProgress.total}`
                : `✦ ولّد صور التقرير (${slides.filter((slide) => slide.data?.canvas === "landscape" && !slide.hidden && !slide.image && slide.imagePrompt.trim()).length})`}
            </button>
          )}
          <button className="th-mini" onClick={() => setPreview(!preview)}>
            {preview ? "أغلق المعاينة" : isLandscapeReport(slides) ? "▭ معاينة التقرير" : "📱 معاينة جاك العلم"}
          </button>
          <button className="th-mini" onClick={() => setPhase("source")}>المصدر</button>
          {isLandscapeReport(slides) && <button className="th-mini" onClick={exportReport}>تصدير PDF</button>}
        </div>
        {dropped.length > 0 && (
          <div className="th-msg err" style={{ padding: "6px 16px 10px" }}>
            أسقط مدقق الأرقام {dropped.length} شريحة: {dropped.map((item) => `«${item.title}» (${item.reason})`).join(" · ")}
          </div>
        )}
        {message && <div className={`th-msg ${message.kind}`} style={{ paddingBottom: blockers.length ? 4 : 10 }}>{message.text}</div>}
        {blockers.length > 0 && (
          <ul className="th-blockers">
            {blockers.map((blocker, index) => (
              <li key={`${blocker.ruleId}-${index}`}>
                <b>{blocker.ruleId}</b>
                <span>{blocker.message}</span>
                {blocker.excerpt && <em>«{blocker.excerpt}»</em>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="th-jak-grid">
        <div>
          {slides.map((slide, index) => (
            <div className={`th-jslide th-panel ${slide.hidden ? "off" : ""}`} key={slide.id}>
              <div className="th-jslide-hd">
                <span className="grip">⠿</span>
                <select
                  className="th-input"
                  style={{ width: "auto", fontSize: 11 }}
                  value={slide.type}
                  onChange={(event) => patch(slide.id, { type: event.target.value as SlideType })}
                >
                  {SLIDE_TYPES.map((type) => (
                    <option key={type} value={type}>{SLIDE_TYPE_NAMES[type]}</option>
                  ))}
                </select>
                <span className="tt">{slide.title || slide.stat || slide.body.slice(0, 40) || "شريحة فارغة"}</span>
                {slide.guard && !slide.guard.ok && <span className="th-gchip block">مخالفة</span>}
                {slide.hidden && <span className="th-gchip warn">مخفية</span>}
                <button className="th-mini" onClick={() => setOpenSlide(openSlide === slide.id ? null : slide.id)}>
                  {openSlide === slide.id ? "أغلق" : "تحرير"}
                </button>
              </div>

              {openSlide === slide.id && (
                <div className="th-jslide-bd">
                  {slide.data?.canvas === "landscape" && (
                    <>
                      <div className="row2">
                        <select
                          className="th-input"
                          value={slide.data.template ?? "image-text"}
                          onChange={(event) => patch(slide.id, { data: { ...slide.data, template: event.target.value as ReportTemplate } })}
                        >
                          {REPORT_TEMPLATES.map((template) => (
                            <option key={template} value={template}>{REPORT_TEMPLATE_NAMES[template]}</option>
                          ))}
                        </select>
                        <input
                          className="th-input"
                          placeholder="التصنيف القصير: بالأرقام"
                          value={slide.data.eyebrow ?? ""}
                          onChange={(event) => patch(slide.id, { data: { ...slide.data, eyebrow: event.target.value } })}
                        />
                      </div>
                      <div className="row2">
                        <select
                          className="th-input"
                          value={slide.data.focalPoint ?? "left"}
                          onChange={(event) => patch(slide.id, { data: { ...slide.data, focalPoint: event.target.value as "left" | "center" | "right" } })}
                        >
                          <option value="left">العنصر البصري يسار</option>
                          <option value="center">العنصر البصري وسط</option>
                          <option value="right">العنصر البصري يمين</option>
                        </select>
                        <select
                          className="th-input"
                          value={slide.data.textSafeArea ?? "right"}
                          onChange={(event) => patch(slide.id, { data: { ...slide.data, textSafeArea: event.target.value as "left" | "center" | "right" } })}
                        >
                          <option value="right">مساحة النص يمين</option>
                          <option value="center">مساحة النص وسط</option>
                          <option value="left">مساحة النص يسار</option>
                        </select>
                      </div>
                    </>
                  )}
                  <input
                    className="th-input"
                    placeholder="عنوان الشريحة (≤10 كلمات)"
                    value={slide.title}
                    onChange={(event) => patch(slide.id, { title: event.target.value })}
                  />
                  <textarea
                    className="th-input"
                    style={{ resize: "vertical", minHeight: 54, fontFamily: "inherit" }}
                    placeholder="نص الشريحة — جملة أو جملتان"
                    value={slide.body}
                    onChange={(event) => patch(slide.id, { body: event.target.value })}
                  />

                  {slide.type === "stat" && (
                    <div className="row2">
                      <input className="th-input ltr" placeholder="73%" value={slide.stat} onChange={(event) => patch(slide.id, { stat: event.target.value })} />
                      <input className="th-input" placeholder="تفسير الرقم في سطر" value={slide.statLabel} onChange={(event) => patch(slide.id, { statLabel: event.target.value })} />
                    </div>
                  )}

                  {slide.type === "comparison" && (
                    <div className="row2">
                      {[0, 1].map((sideIndex) => (
                        <div key={sideIndex} style={{ display: "flex", gap: 6 }}>
                          <input
                            className="th-input"
                            placeholder={sideIndex === 0 ? "الطرف الأول (2019)" : "الطرف الثاني (2026)"}
                            value={slide.data?.sides?.[sideIndex]?.label ?? ""}
                            onChange={(event) => {
                              const sides = [...(slide.data?.sides ?? [{ label: "", value: "" }, { label: "", value: "" }])];
                              sides[sideIndex] = { ...sides[sideIndex], label: event.target.value };
                              patch(slide.id, { data: { ...slide.data, sides } });
                            }}
                          />
                          <input
                            className="th-input ltr"
                            style={{ width: 90 }}
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
                  )}

                  {(slide.type === "list" || slide.type === "summary") && (
                    <textarea
                      className="th-input"
                      style={{ resize: "vertical", minHeight: 70, fontFamily: "inherit" }}
                      placeholder="عنصر في كل سطر"
                      value={(slide.data?.items ?? []).join("\n")}
                      onChange={(event) =>
                        patch(slide.id, {
                          data: { ...slide.data, items: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) },
                        })
                      }
                    />
                  )}

                  {slide.data?.canvas === "landscape" && ["stats", "grid"].includes(slide.data.template ?? "") && (
                    <textarea
                      className="th-input"
                      style={{ resize: "vertical", minHeight: 105, fontFamily: "inherit" }}
                      placeholder="وحدة في كل سطر: القيمة | الوحدة | العنوان | النص"
                      value={(slide.data.blocks ?? []).map((block) => `${block.value} | ${block.label} | ${block.title} | ${block.body}`).join("\n")}
                      onChange={(event) => patch(slide.id, {
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
                      })}
                    />
                  )}

                  {slide.type === "timeline" && (
                    <textarea
                      className="th-input"
                      style={{ resize: "vertical", minHeight: 70, fontFamily: "inherit" }}
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
                  )}

                  {slide.type === "quote" && (
                    <input
                      className="th-input"
                      placeholder="نسبة الاقتباس — من قاله؟"
                      value={slide.data?.quoteBy ?? ""}
                      onChange={(event) => patch(slide.id, { data: { ...slide.data, quoteBy: event.target.value } })}
                    />
                  )}

                  <div className="lb" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--t-ink2)" }}>الصورة التحريرية</div>
                  {slide.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slide.image}
                      alt=""
                      style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8 }}
                      onError={() => {
                        patch(slide.id, { image: null });
                        err("رابط الصورة القديمة مفقود من المخزن — أعد توليد الصورة لهذه الصفحة.");
                      }}
                    />
                  )}
                  <input
                    className="th-input ltr"
                    placeholder="imagePrompt — atmospheric cinematic scene, navy and gold, no people, no text"
                    value={slide.imagePrompt}
                    onChange={(event) => patch(slide.id, { imagePrompt: event.target.value })}
                  />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="th-mini" onClick={() => generateImage(index)} disabled={aiBusy !== null}>
                      {aiBusy === `${slide.id}:image` ? "✦ يولّد…" : slide.image ? "✦ أعد التوليد" : "✦ ولّد الصورة"}
                    </button>
                    {IMAGE_STYLES.map(([styleKey, styleName]) => (
                      <button
                        key={styleKey}
                        className="th-mini"
                        style={slide.imageStyle === styleKey ? { borderColor: "var(--t-gold)", color: "var(--t-gold-ink)" } : undefined}
                        onClick={() => patch(slide.id, { imageStyle: styleKey })}
                      >
                        {styleName}
                      </button>
                    ))}
                    {slide.image && (
                      <button className="th-mini" onClick={() => patch(slide.id, { image: null })}>بلا صورة</button>
                    )}
                  </div>
                  {recentMedia.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {recentMedia.map((item) => (
                        <button
                          key={item.url}
                          className="th-mini"
                          title={item.filename}
                          style={{ padding: 0, width: 40, height: 30, overflow: "hidden", borderColor: slide.image === item.url ? "var(--t-gold)" : undefined }}
                          onClick={() => patch(slide.id, { image: item.url })}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.url} alt={item.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </button>
                      ))}
                    </div>
                  )}

                  {slide.sourceContext && (
                    <div className="th-jsrc">من المصدر: «{slide.sourceContext}»</div>
                  )}
                  {slide.guard && slide.guard.findings.length > 0 && (
                    <div className="th-msg err" style={{ padding: 0 }}>
                      {slide.guard.findings.slice(0, 2).map((finding) => finding.message).join(" · ")}
                    </div>
                  )}
                  {reportLayoutIssues(slide).length > 0 && (
                    <div className="th-msg err" style={{ padding: 0 }}>
                      {reportLayoutIssues(slide).join(" · ")}
                    </div>
                  )}
                </div>
              )}

              <div className="th-jslide-ops">
                <button className="th-mini" onClick={() => move(index, -1)} disabled={index === 0}>▲</button>
                <button className="th-mini" onClick={() => move(index, 1)} disabled={index === slides.length - 1}>▼</button>
                <button className="th-mini" onClick={() => insertAfter(index)}>+ بعدها</button>
                <button className="th-mini" onClick={() => duplicate(index)}>نسخ</button>
                <button className="th-mini" onClick={() => patch(slide.id, { hidden: !slide.hidden })}>
                  {slide.hidden ? "إظهار" : "إخفاء"}
                </button>
                <button className="th-mini" onClick={() => setSlides(slides.filter((item) => item.id !== slide.id))}>حذف</button>
                <span style={{ flex: 1 }} />
                {AI_OPS.map(([op, label]) => (
                  <button
                    key={op}
                    className="th-mini ai"
                    onClick={() => slideOp(index, op)}
                    disabled={aiBusy === `${slide.id}:${op}`}
                  >
                    {aiBusy === `${slide.id}:${op}` ? "✦…" : label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="th-save" style={{ width: "100%" }} onClick={() => setSlides([...slides, blankSlide("text", canvas)])}>
            + شريحة جديدة
          </button>
        </div>

        <div className="th-ed-side">
          {preview && (
            <div className="th-jakprev">
              <div className="th-jakprev-screen">
                {isLandscapeReport(slides) ? (
                  <JakReport
                    meta={{ title, sectionName: sections.find(([slug]) => slug === section)?.[1] ?? section }}
                    slides={slides}
                  />
                ) : (
                  <JakStory
                    meta={{
                      title,
                      sectionName: sections.find(([slug]) => slug === section)?.[1] ?? section,
                      readingMinutes: Math.max(1, Math.round(slides.length / 3)),
                      shareUrl: "https://alelm.net",
                      next: null,
                    }}
                    slides={slides}
                  />
                )}
              </div>
              <div style={{ fontSize: 9.5, color: "var(--t-ink3)", textAlign: "center", marginTop: 6 }}>
                معاينة بجلستك فقط — لا رابط عامًا للمسودة.
              </div>
            </div>
          )}

          <div className="th-panel">
            <div className="th-actions">
              <button className="th-save" onClick={save} disabled={busy}>حفظ جاك العلم</button>
              {status !== "published" && status !== "archived" && (
                <button className="th-send ready" onClick={() => workflow("submit", "الإرسال")} disabled={busy}>
                  إرسال للاعتماد
                </button>
              )}
              {canApprove && status !== "published" && status !== "archived" && (
                <button className="th-send ready" onClick={() => workflow("publish", "النشر")} disabled={busy}>
                  اعتماد ونشر الآن
                </button>
              )}
              {canApprove && status !== "published" && status !== "archived" && (
                <>
                  <input
                    className="th-input"
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(event) => setScheduleAt(event.target.value)}
                    aria-label="موعد الجدولة"
                  />
                  <button className="th-save" onClick={schedule} disabled={busy}>جدولة النشر</button>
                </>
              )}
              {status === "published" && (
                <button className="th-send ready" onClick={save} disabled={busy}>تحديث المنشور</button>
              )}
              {canApprove && status !== "draft" && status !== "archived" && initial?.id ? (
                <ArchiveStoryButton
                  id={initial.id}
                  title={title || "جاك العلم"}
                  onArchived={() => {
                    setStatus("archived");
                    setArchiveEvent({ at: new Date().toISOString(), actor: "", reason: "أُرشفت من المحرر" });
                  }}
                />
              ) : null}
              {canApprove && status === "archived" && initial?.id ? (
                <RestoreStoryButton
                  id={initial.id}
                  title={title || "جاك العلم"}
                  onRestored={() => {
                    setStatus("draft");
                    setArchiveEvent(null);
                  }}
                />
              ) : null}
            </div>
            {status === "archived" && archiveEvent ? (
              <div className="th-archive-banner" style={{ marginTop: 12 }}>
                <b>مؤرشف</b> — {archiveEvent.reason}
              </div>
            ) : null}
            <div className="th-ai-foot">
              النشر يمر بحارس السياسة (سطح بصري) وبنفس أدوار الاعتماد — لا مسار جانبيًا لجاك العلم.
            </div>
          </div>

          <div className="th-panel">
            <div className="th-meta">
              <div className="lb">الموجز (≤180)</div>
              <textarea
                className="th-input"
                maxLength={220}
                rows={3}
                style={{ resize: "vertical", fontFamily: "inherit" }}
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
