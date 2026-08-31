"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { FullEditProgressStage } from "@/lib/ai/editorial";
import { stripHtmlToText } from "@/lib/content/html";
import type { Finding, GuardReport } from "@/lib/policy/types";

import { AiPanel } from "./ai-panel";
import { ArchiveStoryButton, RestoreStoryButton } from "./archive-controls";
import { RichBody, type RichBodyHandle } from "./rich-body";

interface EditorInitial {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  section: string;
  slug: string;
  seriesSlug: string | null;
  image: string | null;
  format: string;
  pinned: boolean;
  breakingUntil: string | null;
  status: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  archiveEvent?: { at: string; actor: string; reason: string } | null;
}

interface GuardVerdict {
  ok: boolean;
  findings: Array<{ ruleId: string; severity: string; message: string }>;
}

interface FullEditData {
  title: { text: string; guard: GuardVerdict };
  excerpt: { text: string; guard: GuardVerdict };
  body: { text: string; guard: GuardVerdict };
  seo: { seoTitle: string; seoDescription: string; keywords: string[]; guard: GuardVerdict };
  classify: { seriesSlug: string | null; section: string; format: string };
}

type ProgressState = "waiting" | "active" | "done";
type InspectorTab = "details" | "seo" | "guard" | "ai";

interface FullEditProgress {
  request: ProgressState;
  body: ProgressState;
  pack: ProgressState;
  guard: ProgressState;
}

interface Props {
  role: string;
  series: Array<{ slug: string; name: string; color: string }>;
  sections: Array<[string, string]>;
  recentMedia: Array<{ url: string; filename: string }>;
  initial: EditorInitial | null;
}

const FORMATS: Array<[string, string]> = [
  ["news", "خبر"],
  ["infographics", "إنفوجرافيك"],
  ["videos", "فيديو"],
  ["reports", "تقرير"],
  ["podcasts", "بودكاست"],
];

const SEVERITY_LABELS: Record<string, string> = {
  blocking: "قاطع",
  warning: "تحذير",
  suggestion: "مقترح",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  review: "بانتظار الاعتماد",
  scheduled: "مجدولة",
  published: "منشورة",
  archived: "مؤرشفة",
};

const INITIAL_FULL_PROGRESS: FullEditProgress = {
  request: "waiting",
  body: "waiting",
  pack: "waiting",
  guard: "waiting",
};

function advanceFullProgress(
  current: FullEditProgress,
  stage: FullEditProgressStage,
): FullEditProgress {
  if (stage === "accepted") return { ...current, request: "done" };
  if (stage === "body_started") return { ...current, request: "done", body: "active" };
  if (stage === "pack_started") return { ...current, request: "done", pack: "active" };
  if (stage === "body_ready") return { ...current, body: "done" };
  if (stage === "pack_ready") return { ...current, pack: "done" };
  if (stage === "guard_checking") {
    return { request: "done", body: "done", pack: "done", guard: "active" };
  }
  return { request: "done", body: "done", pack: "done", guard: "done" };
}

const wordCount = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;

function hoursAhead(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

export function EditorClient({ role, series, sections, recentMedia, initial }: Props) {
  const router = useRouter();
  const [id, setId] = useState(initial?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [section, setSection] = useState(initial?.section ?? "news");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [seriesSlug, setSeriesSlug] = useState(initial?.seriesSlug ?? null);
  const [image, setImage] = useState(initial?.image ?? "");
  const [format, setFormat] = useState(initial?.format ?? "news");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [breakingUntil, setBreakingUntil] = useState<string | null>(initial?.breakingUntil ?? null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [archiveEvent, setArchiveEvent] = useState(initial?.archiveEvent ?? null);
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? "");
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? []);
  const [keywordInput, setKeywordInput] = useState("");
  const [seoBusy, setSeoBusy] = useState(false);
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const [imageUploadMessage, setImageUploadMessage] = useState("");
  const [fullEdit, setFullEdit] = useState<FullEditData | null>(null);
  const [fullBusy, setFullBusy] = useState(false);
  const [fullElapsed, setFullElapsed] = useState(0);
  const [fullProgress, setFullProgress] = useState<FullEditProgress>(INITIAL_FULL_PROGRESS);
  const [fullEditStale, setFullEditStale] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("details");
  const [report, setReport] = useState<GuardReport | null>(null);
  const [guardBusy, setGuardBusy] = useState(true);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardSequence = useRef(0);
  const richRef = useRef<RichBodyHandle | null>(null);
  const imageFileRef = useRef<HTMLInputElement | null>(null);
  const fullAbort = useRef<AbortController | null>(null);
  const draftRevision = useRef(0);
  const fullStartRevision = useRef(0);

  const bodyText = () => richRef.current?.getText() ?? stripHtmlToText(body);

  function markDraftChanged() {
    draftRevision.current += 1;
    if (fullEdit) setFullEditStale(true);
  }

  const runGuard = useCallback(async (
    nextTitle: string,
    nextBodyText: string,
    nextImage: string,
    nextFormat: string,
  ) => {
    const sequence = ++guardSequence.current;
    setGuardBusy(true);
    const response = await fetch("/api/tahrir/guard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: nextTitle, body: nextBodyText, image: nextImage || null, format: nextFormat }),
    }).catch(() => null);
    if (sequence !== guardSequence.current) return;
    if (response?.ok) setReport((await response.json()) as GuardReport);
    else setReport(null);
    setGuardBusy(false);
  }, []);

  function scheduleGuard(nextTitle: string, nextBodyText: string, nextImage = image, nextFormat = format) {
    if (timer.current) clearTimeout(timer.current);
    setGuardBusy(true);
    timer.current = setTimeout(() => void runGuard(nextTitle, nextBodyText, nextImage, nextFormat), 600);
  }

  useEffect(() => {
    timer.current = setTimeout(() => void runGuard(title, stripHtmlToText(body), image, format), 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      guardSequence.current += 1;
    };
    // الفحص الأول يعكس القيم المحمّلة لحظة فتح المحرر؛ التعديلات اللاحقة تمر عبر scheduleGuard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runGuard]);

  useEffect(() => {
    if (!fullBusy) return;
    const started = Date.now();
    const tick = window.setInterval(() => {
      setFullElapsed(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => {
      window.clearInterval(tick);
      setFullElapsed(0);
    };
  }, [fullBusy]);

  useEffect(() => () => fullAbort.current?.abort(), []);

  function onTitle(value: string) {
    markDraftChanged();
    setTitle(value);
    scheduleGuard(value, bodyText());
  }

  function onBody(html: string, text: string) {
    markDraftChanged();
    setBody(html);
    scheduleGuard(title, text);
  }

  function applyFix(finding: Finding) {
    if (!finding.autofix) return;
    const { field, from, to } = finding.autofix;
    if (field === "title") {
      onTitle(title.replace(from, to));
      return;
    }
    // المتن HTML: الاستبدال فيه مباشرة إن وُجد النص متصلًا، وإلا على النص الخالص.
    if (body.includes(from)) {
      const next = body.replace(from, to);
      richRef.current?.setHtml(next);
    } else {
      richRef.current?.setPlainText(bodyText().replace(from, to));
    }
  }

  function addKeyword(raw: string) {
    const value = raw.replace(/^#/, "").trim();
    if (!value || keywords.includes(value) || keywords.length >= 12) return;
    markDraftChanged();
    setKeywords([...keywords, value]);
  }

  async function uploadStoryImage(files: FileList | null) {
    const file = files?.[0];
    if (!file || imageUploadBusy) return;
    setImageUploadBusy(true);
    setImageUploadMessage("جارٍ رفع الصورة…");

    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/tahrir/media", { method: "POST", body: form }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setImageUploadBusy(false);
    if (!response?.ok || !data?.url) {
      setImageUploadMessage(data?.error ?? "تعذر رفع الصورة.");
      return;
    }

    setImage(data.url);
    scheduleGuard(title, bodyText(), data.url, format);
    setImageUploadMessage("رُفعت واختيرت للمادة — يلزم توثيق الحقوق قبل الاعتماد.");
    if (imageFileRef.current) imageFileRef.current.value = "";
  }

  async function generateSeo() {
    if (seoBusy) return;
    setSeoBusy(true);
    setMessage(null);
    const response = await fetch("/api/tahrir/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "seo", title, body: bodyText() }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setSeoBusy(false);
    if (!response?.ok || !data?.seo) {
      setMessage({ kind: "err", text: data?.error ?? "تعذر توليد SEO." });
      return;
    }
    markDraftChanged();
    setSeoTitle(data.seo.seoTitle);
    setSeoDescription(data.seo.seoDescription);
    setKeywords(data.seo.keywords);
  }

  async function runFullEdit() {
    if (fullBusy) return;
    const draftBody = bodyText().trim();
    if (!draftBody) {
      setMessage({ kind: "err", text: "اكتب المتن أولًا ليعمل التحرير الشامل عليه." });
      return;
    }
    const controller = new AbortController();
    fullAbort.current = controller;
    fullStartRevision.current = draftRevision.current;
    setFullBusy(true);
    setFullEdit(null);
    setFullEditStale(false);
    setFullProgress({ ...INITIAL_FULL_PROGRESS, request: "active" });
    setMessage(null);
    let streamedResult: { fullEdit?: FullEditData } | null = null;

    try {
      const response = await fetch("/api/tahrir/ai/assist", {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tool: "full_edit", title, body: draftBody }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "تعذر التحرير الشامل.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type?: string;
            stage?: FullEditProgressStage;
            error?: string;
            data?: { fullEdit?: FullEditData };
          };
          if (event.type === "progress" && event.stage) {
            setFullProgress((current) => advanceFullProgress(current, event.stage!));
          } else if (event.type === "result" && event.data) {
            streamedResult = event.data;
          } else if (event.type === "error") {
            throw new Error(event.error ?? "تعذر التحرير الشامل.");
          }
        }

        if (done) break;
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setMessage({ kind: "ok", text: "أُوقف التحرير الذكي ولم يُطبّق أي تغيير." });
      } else {
        setMessage({
          kind: "err",
          text: error instanceof Error ? error.message : "تعذر التحرير الشامل.",
        });
      }
      setFullBusy(false);
      fullAbort.current = null;
      return;
    }

    setFullBusy(false);
    fullAbort.current = null;
    if (!streamedResult?.fullEdit) {
      setMessage({ kind: "err", text: "اكتمل الاتصال بلا نتيجة قابلة للمراجعة." });
      return;
    }
    setFullProgress({ request: "done", body: "done", pack: "done", guard: "done" });
    setFullEdit(streamedResult.fullEdit);
    setFullEditStale(draftRevision.current !== fullStartRevision.current);
  }

  function stopFullEdit() {
    fullAbort.current?.abort();
  }

  function applyFullEdit() {
    if (!fullEdit || fullEditStale) return;
    onTitle(fullEdit.title.text);
    setExcerpt(fullEdit.excerpt.text);
    richRef.current?.setPlainText(fullEdit.body.text);
    setSeoTitle(fullEdit.seo.seoTitle);
    setSeoDescription(fullEdit.seo.seoDescription);
    setKeywords(fullEdit.seo.keywords);
    if (fullEdit.classify.seriesSlug) setSeriesSlug(fullEdit.classify.seriesSlug);
    setSection(fullEdit.classify.section);
    setFormat(fullEdit.classify.format);
    scheduleGuard(fullEdit.title.text, fullEdit.body.text, image, fullEdit.classify.format);
    setFullEdit(null);
    setFullEditStale(false);
    setMessage({ kind: "ok", text: "طُبّق التحرير الشامل — راجع ثم احفظ؛ لا يُنشر شيء آليًا." });
  }

  async function save(): Promise<string | null> {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/tahrir/story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id || undefined, title, excerpt, body: richRef.current?.getHtml() ?? body, section, slug, seriesSlug, image: image || null, format, seoTitle, seoDescription, keywords, pinned, breakingUntil }),
    }).catch(() => null);
    setBusy(false);

    const data = await response?.json().catch(() => null);
    if (!response?.ok) {
      setMessage({ kind: "err", text: data?.error ?? "تعذر الحفظ." });
      return null;
    }

    setId(data.id);
    setSlug(data.slug);
    if (!initial) setStatus("draft");
    setMessage({ kind: "ok", text: "حُفظت المسودة." });
    return data.id as string;
  }

  async function submitForReview() {
    const savedId = await save();
    if (!savedId) return;

    setBusy(true);
    const response = await fetch("/api/tahrir/story/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: savedId }),
    }).catch(() => null);
    setBusy(false);

    const data = await response?.json().catch(() => null);
    if (!response?.ok) {
      if (response?.status === 422) {
        await runGuard(title, bodyText(), image, format);
        setInspectorTab("guard");
      }
      const blockingRules = Array.isArray(data?.blocking) && data.blocking.length > 0
        ? ` (${data.blocking.join("، ")})`
        : "";
      setMessage({ kind: "err", text: `${data?.error ?? "رفض الحارس الإرسال."}${blockingRules}` });
      return;
    }
    setStatus("review");
    setMessage({ kind: "ok", text: "أُرسلت للاعتماد — بانتظار المعتمد البشري." });
  }

  async function schedule() {
    if (!scheduleAt) {
      setMessage({ kind: "err", text: "اختر موعد الجدولة أولًا." });
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
    setBusy(false);

    const data = await response?.json().catch(() => null);
    if (!response?.ok) {
      setMessage({ kind: "err", text: data?.error ?? "تعذرت الجدولة." });
      return;
    }
    setStatus("scheduled");
    setMessage({ kind: "ok", text: "جُدولت — الحارس سيفحصها ثانية لحظة الموعد." });
  }

  async function publish() {
    const savedId = await save();
    if (!savedId) return;

    setBusy(true);
    const response = await fetch("/api/tahrir/story/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: savedId }),
    }).catch(() => null);
    setBusy(false);

    const data = await response?.json().catch(() => null);
    if (!response?.ok) {
      setMessage({ kind: "err", text: data?.error ?? "تعذر النشر." });
      return;
    }
    setStatus("published");
    setMessage({ kind: "ok", text: "نُشرت المادة على الموقع." });
    router.refresh();
  }

  const titleWords = wordCount(title);
  const blocking = report?.counts.blocking ?? 0;
  const gateOpen = !guardBusy && report?.canRequestApproval === true;
  const canApprove = role === "approver" || role === "chief";

  return (
    <div className="th-editor-shell">
      <div className="th-editor-head">
        <div className="th-editor-head-copy">
          <div className="eyebrow">{initial ? "تحرير المادة" : "مادة جديدة"}</div>
          <div className="state-row">
            <span className={`th-pill ${status === "published" ? "pub" : status === "review" ? "rev" : status === "scheduled" ? "sch" : status === "archived" ? "arc" : "dft"}`}>
              {STATUS_LABELS[status] ?? status}
            </span>
            <span className={gateOpen ? "ready" : "blocked"}>
              {guardBusy ? "يفحص الحارس…" : gateOpen ? "جاهزة للاعتماد" : `${blocking} مخالفة قاطعة`}
            </span>
          </div>
        </div>
        <div className="th-editor-actions" aria-label="إجراءات المادة">
          <button className="th-save" onClick={save} disabled={busy}>
            {busy ? "يحفظ…" : status === "published" ? "تحديث المادة" : "حفظ المسودة"}
          </button>
          {status !== "published" && status !== "archived" && (
            <button
              className={`th-send ${gateOpen && !busy ? "ready" : ""}`}
              onClick={submitForReview}
              disabled={!gateOpen || busy}
            >
              إرسال للاعتماد
            </button>
          )}
          {canApprove && status !== "published" && status !== "archived" && (
            <button
              className={`th-send th-publish ${gateOpen && !busy ? "ready" : ""}`}
              onClick={publish}
              disabled={!gateOpen || busy}
            >
              اعتماد ونشر
            </button>
          )}
        </div>
      </div>

      {message && <div className={`th-msg th-editor-message ${message.kind}`}>{message.text}</div>}

      <div className="th-ed">
        <div className="th-ed-main">
        <div className="th-field-label">
          <label htmlFor="story-title">العنوان</label>
          <span className={titleWords > 10 ? "bad" : "good"}>
            {titleWords} من 10 كلمات
          </span>
        </div>
        <input
          id="story-title"
          className="th-ed-title"
          placeholder="عنوان المادة…"
          value={title}
          onChange={(event) => onTitle(event.target.value)}
        />
        <div className="th-field-label th-summary-label">
          <label htmlFor="story-excerpt">قبل القراءة</label>
          <span className={excerpt.length > 180 ? "bad" : "good"}>
            {excerpt.length} من 180 حرفًا
          </span>
        </div>
        <textarea
          id="story-excerpt"
          className="th-ed-sum"
          placeholder="✦ قبل القراءة — خلاصة في سطر واحد"
          maxLength={220}
          value={excerpt}
          onChange={(event) => {
            markDraftChanged();
            setExcerpt(event.target.value);
          }}
        />
        {!fullBusy && (
          <div className="th-fullbar">
            <span className="th-full-icon" aria-hidden="true">✦</span>
            <span className="copy">
              <b>تحرير ذكي شامل</b>
              <span className="hint">
                يحرر المتن ويقترح العنوان والموجز وSEO والتصنيف — ثم يعرضه عليك قبل التطبيق.
              </span>
            </span>
            <button type="button" className="th-fullbtn" onClick={runFullEdit}>
              ابدأ التحليل
            </button>
          </div>
        )}

        {fullBusy && (
          <div className="th-full-progress" role="status" aria-live="polite">
            <div className="th-full-progress-head">
              <span className="th-ai-orb" aria-hidden="true" />
              <span className="copy">
                <b>محرر العلم يعمل على المسودة</b>
                <span>يمكنك متابعة الكتابة؛ لن يُطبّق أي تغيير دون موافقتك.</span>
              </span>
              <span className="elapsed">{String(Math.floor(fullElapsed / 60)).padStart(2, "0")}:{String(fullElapsed % 60).padStart(2, "0")}</span>
            </div>
            <div className="th-full-steps" aria-label="مراحل التحرير الذكي">
              {([
                ["request", "تجهيز الطلب"],
                ["body", "تحرير المتن"],
                ["pack", "العنوان وSEO"],
                ["guard", "فحص السياسة"],
              ] as const).map(([key, label]) => (
                <span key={key} className={`step ${fullProgress[key]}`}>
                  {label}
                </span>
              ))}
            </div>
            <div className="th-full-progress-foot">
              <span>قد يطول قليلًا مع المواد الكبيرة.</span>
              <button type="button" onClick={stopFullEdit}>إيقاف</button>
            </div>
          </div>
        )}

        {fullEdit && (
          <div className="th-fullr">
            <div className="fr-hd">
              <b>مقترح التحرير الشامل</b>
              <span className={`th-gchip ${fullEdit.body.guard.ok && fullEdit.title.guard.ok ? "ok" : "block"}`}>
                {fullEdit.body.guard.ok && fullEdit.title.guard.ok ? "مرّ على الحارس" : "فيه مخالفات — راجع"}
              </span>
            </div>
            {fullEditStale && (
              <div className="th-full-stale" role="alert">
                تغيّرت المسودة أثناء التحليل. أعد التحليل على النسخة الحالية لتجنب استبدال تعديلاتك الجديدة.
              </div>
            )}
            <div className="fr-row"><span className="lb">العنوان</span><b>{fullEdit.title.text}</b></div>
            <div className="fr-row"><span className="lb">الموجز</span>{fullEdit.excerpt.text}</div>
            <div className="fr-row bx">{fullEdit.body.text}</div>
            <div className="fr-row">
              <span className="lb">SEO</span>
              {fullEdit.seo.seoTitle} · {fullEdit.seo.seoDescription}
            </div>
            <div className="fr-row">
              <span className="lb">الكلمات</span>
              {fullEdit.seo.keywords.join("، ")}
            </div>
            <div className="fr-row">
              <span className="lb">التصنيف</span>
              {fullEdit.classify.seriesSlug ?? "بلا سلسلة"} · {fullEdit.classify.section} · {fullEdit.classify.format}
            </div>
            <div className="fr-acts">
              <button type="button" className="th-ai-ins" onClick={applyFullEdit} disabled={fullEditStale}>
                {fullEditStale ? "التطبيق متوقف لحماية تعديلاتك" : "طبّق الكل — القرار لك"}
              </button>
              {fullEditStale && (
                <button type="button" className="th-mini" onClick={runFullEdit}>أعد التحليل</button>
              )}
              <button type="button" className="th-mini" onClick={() => setFullEdit(null)}>
                تجاهل
              </button>
            </div>
          </div>
        )}

        <RichBody
          ref={richRef}
          initial={initial?.body ?? ""}
          onChange={(html, text) => onBody(html, text)}
        />
        </div>

        <div className="th-ed-side">
          <div className="th-inspector-tabs" role="tablist" aria-label="لوحات المحرر">
            {([
              ["details", "المادة"],
              ["seo", "SEO"],
              ["guard", `الحارس${report?.findings.length ? ` ${report.findings.length}` : ""}`],
              ["ai", "مساعد AI"],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={inspectorTab === tab}
                onClick={() => setInspectorTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>

        {inspectorTab === "ai" && (
          <AiPanel
          getDraft={() => ({
            title,
            body: bodyText(),
            selection: richRef.current?.getSelectionText() || undefined,
          })}
          onInsertTitle={(text) => onTitle(text)}
          onInsertExcerpt={(text) => {
            markDraftChanged();
            setExcerpt(text);
          }}
          onReplaceBody={(text, selectionOnly) => {
            if (selectionOnly) richRef.current?.replaceSelection(text);
            else richRef.current?.setPlainText(text);
          }}
          onClassify={(c) => {
            markDraftChanged();
            if (c.seriesSlug) setSeriesSlug(c.seriesSlug);
            setSection(c.section);
            setFormat(c.format);
            scheduleGuard(title, bodyText(), image, c.format);
          }}
        />
        )}

        {inspectorTab === "seo" && (
        <div className="th-panel">
          <div className="th-meta">
            <div className="lb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              SEO والكلمات المفتاحية
              <button
                type="button"
                className="th-mini"
                style={{ marginInlineStart: "auto" }}
                onClick={generateSeo}
                disabled={seoBusy}
              >
                {seoBusy ? "✦ يولّد…" : "✦ ولّد من المتن"}
              </button>
            </div>
            <input
              className="th-input"
              placeholder="عنوان البحث (يسقط للعنوان إن تُرك)"
              maxLength={90}
              value={seoTitle}
              onChange={(event) => {
                markDraftChanged();
                setSeoTitle(event.target.value);
              }}
            />
            <div className="th-ed-cnt" style={{ margin: "3px 0 8px" }}>
              <span className={seoTitle.length > 60 ? "bad" : "good"}>{seoTitle.length}/60</span>
            </div>
            <textarea
              className="th-input"
              placeholder="وصف البحث (يسقط للموجز إن تُرك)"
              maxLength={200}
              rows={3}
              style={{ resize: "vertical", fontFamily: "inherit" }}
              value={seoDescription}
              onChange={(event) => {
                markDraftChanged();
                setSeoDescription(event.target.value);
              }}
            />
            <div className="th-ed-cnt" style={{ margin: "3px 0 8px" }}>
              <span className={seoDescription.length > 155 ? "bad" : "good"}>
                {seoDescription.length}/155
              </span>
            </div>
            <div className="th-kw">
              {keywords.map((keyword) => (
                <span className="kw" key={keyword}>
                  {keyword}
                  <button
                    type="button"
                    aria-label={`حذف ${keyword}`}
                    onClick={() => {
                      markDraftChanged();
                      setKeywords(keywords.filter((item) => item !== keyword));
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                className="th-input"
                style={{ flex: 1, minWidth: 110 }}
                placeholder="كلمة مفتاحية + Enter"
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addKeyword(keywordInput);
                    setKeywordInput("");
                  }
                }}
              />
            </div>
          </div>
        </div>
        )}

        {inspectorTab === "guard" && (
        <div className="th-panel">
          <div className="th-guard-hd">
            <span className={`dot ${!guardBusy && report && blocking === 0 ? "ok" : ""}`} />
            <h2>حارس السياسة</h2>
            <span className="cnt">
              {report ? `${report.rulesEvaluated} قاعدة · ${report.findings.length} ملاحظات` : "اكتب ليفحص"}
            </span>
          </div>

          {report?.findings.slice(0, 8).map((finding, index) => (
            <div className={`th-find f-${finding.severity}`} key={`${finding.ruleId}-${index}`}>
              <div className="fh">
                <span className="sv">{SEVERITY_LABELS[finding.severity]}</span>
                <span className="rid">{finding.ruleId}</span>
              </div>
              <div className="fx">{finding.message}</div>
              {finding.autofix && (
                <button className="th-fix" onClick={() => applyFix(finding)}>
                  أصلح آليًا
                </button>
              )}
            </div>
          ))}

          <div className={`th-gate ${gateOpen ? "open" : ""}`}>
            {guardBusy || !report ? (
              <><b>جارٍ فحص المادة</b> — لا يمكن طلب الاعتماد قبل اكتمال الحارس.</>
            ) : gateOpen ? (
              <>
                <b>البوابة مفتوحة</b> — لا مخالفات قاطعة. الاعتماد النهائي بشري دائمًا.
              </>
            ) : (
              <>
                <b>ممنوع طلب الاعتماد</b> حتى معالجة: {report.audit.blockingRuleIds.join("، ")}
              </>
            )}
          </div>

          {status === "archived" && (
            <div className="th-archive-banner">
              <b>هذه المادة مؤرشفة</b>
              {archiveEvent ? (
                <span>
                  {" "}
                  — أُرشفت{" "}
                  {new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }).format(new Date(archiveEvent.at))}
                  {archiveEvent.actor ? ` بواسطة ${archiveEvent.actor}` : ""} — السبب:{" "}
                  {archiveEvent.reason}
                </span>
              ) : (
                <span> — مخفية عن الموقع. استعدها كمسودة ثم انشرها من جديد إن لزم.</span>
              )}
            </div>
          )}

        </div>
        )}

        {inspectorTab === "details" && (
          <>
        {canApprove && (
          <div className="th-panel">
            {status !== "archived" && (
              <div className="th-meta">
                <div className="lb">إبراز المادة</div>
                <div className="th-publish-tools">
                  <button
                    className="th-mini"
                    style={pinned ? { background: "var(--t-gold)", borderColor: "var(--t-gold)", color: "#1a1503", fontWeight: 700 } : undefined}
                    onClick={() => setPinned(!pinned)}
                  >
                    {pinned ? "★ مثبتة في صدارة الرئيسية — اضغط للإلغاء" : "تثبيت في صدارة الرئيسية"}
                  </button>
                  {breakingUntil ? (
                    <div className="th-breaking-state">
                      <span className="th-gchip block">عاجل حتى {breakingUntil.slice(11, 16)} UTC</span>{" "}
                      <button className="th-mini" onClick={() => setBreakingUntil(null)}>
                        أنهِ العاجل
                      </button>
                    </div>
                  ) : (
                    <div className="th-inline-actions">
                      <button className="th-mini" onClick={() => setBreakingUntil(hoursAhead(2))}>
                        ⚡ عاجل لساعتين
                      </button>
                      <button className="th-mini" onClick={() => setBreakingUntil(hoursAhead(6))}>
                        عاجل لست ساعات
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="th-meta">
              <div className="lb">النشر والجدولة</div>
              {status !== "published" && status !== "archived" && (
                <div className="th-schedule-row">
                  <input
                    className="th-input"
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(event) => setScheduleAt(event.target.value)}
                    aria-label="موعد الجدولة"
                  />
                  <button className="th-save" onClick={schedule} disabled={!gateOpen || busy}>
                    {status === "scheduled" ? "تعديل الموعد" : "جدولة"}
                  </button>
                </div>
              )}
              <div className="th-inline-actions th-archive-actions">
                {status !== "draft" && status !== "archived" && id ? (
                  <ArchiveStoryButton
                    id={id}
                    title={title || "هذه المادة"}
                    onArchived={() => {
                      setStatus("archived");
                      setArchiveEvent({
                        at: new Date().toISOString(),
                        actor: "",
                        reason: "أُرشفت من المحرر",
                      });
                    }}
                  />
                ) : null}
                {status === "archived" && id ? (
                  <RestoreStoryButton
                    id={id}
                    title={title || "هذه المادة"}
                    onRestored={() => {
                      setStatus("draft");
                      setArchiveEvent(null);
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}

        <div className="th-panel">
          <div className="th-meta">
            <div className="lb">الشكل</div>
            <div className="th-serpick">
              {FORMATS.map(([slug2, name]) => (
                <button
                  key={slug2}
                  className={format === slug2 ? "on" : ""}
                  style={{ "--sc": "var(--t-navy)" } as React.CSSProperties}
                  onClick={() => {
                    markDraftChanged();
                    setFormat(slug2);
                    scheduleGuard(title, bodyText(), image, slug2);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="th-meta">
            <div className="lb">السلسلة</div>
            <div className="th-serpick">
              {series.map((item) => (
                <button
                  key={item.slug}
                  className={seriesSlug === item.slug ? "on" : ""}
                  style={{ "--sc": item.color } as React.CSSProperties}
                  onClick={() => {
                    markDraftChanged();
                    setSeriesSlug(seriesSlug === item.slug ? null : item.slug);
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          <div className="th-meta">
            <div className="lb">القسم</div>
            <select
              className="th-input"
              value={section}
              onChange={(event) => {
                markDraftChanged();
                setSection(event.target.value);
              }}
            >
              {sections.map(([slug2, name]) => (
                <option key={slug2} value={slug2}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="th-meta">
            <div className="lb">صورة المادة</div>
            <div className="th-image-upload">
              <button
                type="button"
                className="th-mini"
                onClick={() => imageFileRef.current?.click()}
                disabled={imageUploadBusy}
              >
                {imageUploadBusy ? "يرفع…" : "↑ رفع صورة"}
              </button>
              <span>PNG / JPEG / WebP حتى 8MB</span>
              <input
                ref={imageFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(event) => void uploadStoryImage(event.target.files)}
              />
            </div>
            {imageUploadMessage && <div className="th-image-upload-msg">{imageUploadMessage}</div>}
            <input
              className="th-input ltr"
              placeholder="/uploads/… أو رابط خارجي"
              value={image}
              onChange={(event) => {
                setImage(event.target.value);
                scheduleGuard(title, bodyText(), event.target.value, format);
              }}
            />
            {image && (
              <div className="th-image-preview">
                {/* مسار ديناميكي من المكتبة؛ المعاينة تعرض الأصل مباشرة. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="معاينة صورة المادة" />
                <button
                  type="button"
                  className="th-mini"
                  onClick={() => {
                    setImage("");
                    setImageUploadMessage("");
                    scheduleGuard(title, bodyText(), "", format);
                  }}
                >
                  إزالة الصورة
                </button>
              </div>
            )}
            {recentMedia.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {recentMedia.map((item) => (
                  <button
                    key={item.url}
                    className="th-mini"
                    title={item.filename}
                    style={{
                      padding: 0,
                      width: 44,
                      height: 32,
                      overflow: "hidden",
                      borderColor: image === item.url ? "var(--t-gold)" : undefined,
                    }}
                    onClick={() => {
                      setImage(item.url);
                      scheduleGuard(title, bodyText(), item.url, format);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.filename}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: 9.5, color: "var(--t-ink3)", marginTop: 6 }}>
              المصغرات من المكتبة موثقة الحقوق فقط — صورة غير موثقة تمنع النشر (§12).
            </div>
          </div>
          <div className="th-meta">
            <div className="lb">الرابط (لاتيني)</div>
            <input
              className="th-input ltr"
              placeholder="my-story-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </div>
        </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
