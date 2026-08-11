"use client";

/**
 * محرر «جاك العلم» — من لصق التقرير إلى شرائح جاهزة للاعتماد.
 * الذكاء يقترح الخطة والعمليات محددة النطاق؛ كل قرار تطبيق بيد المحرر،
 * والنشر يمر بمسارات المواد الحالية نفسها (الحارس والأدوار كما هي).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { JakSlide, SlideType } from "@/lib/tahrir/jak";
import { SLIDE_TYPE_NAMES, SLIDE_TYPES } from "@/lib/tahrir/jak";

import { JakStory } from "@/app/_components/jak-slides";

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

const blankSlide = (type: SlideType = "text"): EditorSlide => ({
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
  data: null,
});

export function JakEditor({ role, sections, recentMedia, initial }: Props) {
  const router = useRouter();
  const [id, setId] = useState(initial?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [section, setSection] = useState(initial?.section ?? "current-events");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [source, setSource] = useState(initial?.source ?? "");
  const [slides, setSlides] = useState<EditorSlide[]>(initial?.slides ?? []);
  const [dropped, setDropped] = useState<Array<{ title: string; reason: string }>>([]);
  const [phase, setPhase] = useState<"source" | "analyzing" | "slides">(
    initial && initial.slides.length > 0 ? "slides" : "source",
  );
  const [openSlide, setOpenSlide] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const canApprove = role === "approver" || role === "chief";
  const err = (text: string) => setMessage({ kind: "err", text });
  const ok = (text: string) => setMessage({ kind: "ok", text });

  /* ============ التحليل ============ */

  async function analyze() {
    setPhase("analyzing");
    setMessage(null);
    const response = await fetch("/api/tahrir/jak/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, source }),
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
    setSlides(slides.map((slide) => (slide.id === slideId ? { ...slide, ...partial } : slide)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    setSlides(next);
  };

  const insertAfter = (index: number) => {
    const next = [...slides];
    next.splice(index + 1, 0, blankSlide());
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
    next.splice(index, 1, ...(data.slides as EditorSlide[]).map((item) => ({ ...item, image: slide.image })));
    if (op === "split" && data.slides.length > 1) next[index + 1].image = null;
    setSlides(next);
    ok("طُبّق المقترح — القرار النهائي عند الحفظ.");
  }

  async function generateImage(index: number) {
    const slide = slides[index];
    const prompt = slide.imagePrompt.trim();
    if (!prompt) {
      err("اكتب وصف الخلفية أولًا (imagePrompt).");
      return;
    }
    setAiBusy(`${slide.id}:image`);
    const response = await fetch("/api/tahrir/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, style: slide.imageStyle ?? "real", size: "portrait" }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setAiBusy(null);
    if (!response?.ok || !data?.images?.[0]?.url) {
      err(data?.error ?? "تعذر توليد الخلفية.");
      return;
    }
    patch(slide.id, { image: data.images[0].url });
    ok("وُلّدت الخلفية ودخلت المكتبة موثقة الحقوق.");
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

    const slidesResponse = await fetch("/api/tahrir/jak/slides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId: storyData.id, source, slides }),
    }).catch(() => null);
    const slidesData = await slidesResponse?.json().catch(() => null);
    setBusy(false);
    if (!slidesResponse?.ok) {
      err(slidesData?.error ?? "حُفظت المادة وتعذر حفظ الشرائح.");
      return null;
    }

    setId(storyData.id);
    if (!initial) setStatus("draft");
    ok("حُفظ جاك العلم بشرائحه.");
    if (!initial?.id) router.replace(`/tahrir/jak/${storyData.id}`);
    return storyData.id as string;
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
      err(data?.error ?? `تعذر ${label}.`);
      return;
    }
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
      err(data?.error ?? "تعذرت الجدولة.");
      return;
    }
    setStatus("scheduled");
    ok("جُدول — الحارس يفحصه ثانية لحظة الموعد.");
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
              <button className="th-send ready" onClick={analyze} disabled={!source.trim()}>
                ✦ حوّل إلى جاك العلم
              </button>
              <button
                className="th-save"
                onClick={() => {
                  setSlides([blankSlide("hero"), blankSlide(), blankSlide("end")]);
                  setPhase("slides");
                }}
              >
                أو ابدأ بشرائح فارغة يدويًا
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
          <span className={`th-pill ${status === "published" ? "pub" : status === "review" ? "rev" : status === "scheduled" ? "sch" : "dft"}`}>
            {status === "published" ? "منشور" : status === "review" ? "بانتظار الاعتماد" : status === "scheduled" ? "مجدول" : "مسودة"}
          </span>
          <button className="th-mini" onClick={() => setPreview(!preview)}>
            {preview ? "أغلق المعاينة" : "📱 معاينة جاك العلم"}
          </button>
          <button className="th-mini" onClick={() => setPhase("source")}>المصدر</button>
        </div>
        {dropped.length > 0 && (
          <div className="th-msg err" style={{ padding: "6px 16px 10px" }}>
            أسقط مدقق الأرقام {dropped.length} شريحة: {dropped.map((item) => `«${item.title}» (${item.reason})`).join(" · ")}
          </div>
        )}
        {message && <div className={`th-msg ${message.kind}`} style={{ paddingBottom: 10 }}>{message.text}</div>}
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

                  <div className="lb" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--t-ink2)" }}>الخلفية الجوية</div>
                  {slide.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slide.image} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8 }} />
                  )}
                  <input
                    className="th-input ltr"
                    placeholder="imagePrompt — atmospheric cinematic scene, navy and gold, no people, no text"
                    value={slide.imagePrompt}
                    onChange={(event) => patch(slide.id, { imagePrompt: event.target.value })}
                  />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="th-mini" onClick={() => generateImage(index)} disabled={aiBusy === `${slide.id}:image`}>
                      {aiBusy === `${slide.id}:image` ? "✦ يولّد…" : slide.image ? "✦ أعد التوليد" : "✦ ولّد الخلفية"}
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
          <button className="th-save" style={{ width: "100%" }} onClick={() => setSlides([...slides, blankSlide()])}>
            + شريحة جديدة
          </button>
        </div>

        <div className="th-ed-side">
          {preview && (
            <div className="th-jakprev">
              <div className="th-jakprev-screen">
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
              </div>
              <div style={{ fontSize: 9.5, color: "var(--t-ink3)", textAlign: "center", marginTop: 6 }}>
                معاينة بجلستك فقط — لا رابط عامًا للمسودة.
              </div>
            </div>
          )}

          <div className="th-panel">
            <div className="th-actions">
              <button className="th-save" onClick={save} disabled={busy}>حفظ جاك العلم</button>
              {status !== "published" && (
                <button className="th-send ready" onClick={() => workflow("submit", "الإرسال")} disabled={busy}>
                  إرسال للاعتماد
                </button>
              )}
              {canApprove && status !== "published" && (
                <button className="th-send ready" onClick={() => workflow("publish", "النشر")} disabled={busy}>
                  اعتماد ونشر الآن
                </button>
              )}
              {canApprove && status !== "published" && (
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
            </div>
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
