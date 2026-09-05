"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLinkIcon, SaveIcon, SendIcon, ShieldCheckIcon } from "lucide-react";

import { StatusPill } from "@/components/tahrir/badges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { FullEditProgressStage, MetadataResult } from "@/lib/ai/editorial";
import { stripHtmlToText } from "@/lib/content/html";
import { normalizeVideoUrl } from "@/lib/content/video";
import type { Finding, GuardReport } from "@/lib/policy/types";
import type { GuardControls } from "@/lib/policy";
import { cn } from "@/lib/utils";

import { useDraftRecovery } from "@/components/tahrir/use-draft-recovery";
import { useDraftAutosave } from "@/components/tahrir/use-draft-autosave";

import { AiPanel } from "./ai-panel";
import { FieldGenerator } from "./field-generator";
import { MetadataGenerator } from "./metadata-generator";
import { ArticleLinks } from "./article-links";
import { DetailsPanel } from "./details-panel";
import { FullEditBar, FullEditProgressView, FullEditProposal, type FullEditData, type FullEditProgress } from "./full-edit";
import { GuardPanel } from "./guard-panel";
import { RichBody, type RichBodyHandle } from "./rich-body";
import { SeoPanel } from "./seo-panel";

interface EditorInitial {
  version: number;
  revisionOf: string | null;
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
  publishedAt?: string | null;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  videoUrl: string | null;
  archiveEvent?: { at: string; actor: string; reason: string } | null;
}

type InspectorTab = "details" | "seo" | "guard" | "ai";

interface Props {
  actorId: string;
  /** يملك الاعتماد والنشر (story.publish) — يُحلّ على الخادم. */
  canApprove: boolean;
  guardControls: GuardControls;
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

/** العنوان حقل متعدد الأسطر ينمو مع النص — بلا شريط تمرير ولا قصّ للعناوين الطويلة. */
function autoGrow(event: React.FormEvent<HTMLTextAreaElement>) {
  const element = event.currentTarget;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`;
}
function autoGrowOnMount(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`;
}

/**
 * محرر المادة — المنطق (الحارس الحي، الحفظ، سير الاعتماد، التحرير الشامل المبثوث) كما هو منذ المرحلة
 * الأولى؛ الواجهة على shadcn: شريط إجراءات لاصق، متن Tiptap، ومفتّش جانبي بأربعة تبويبات.
 */
export function EditorClient({ actorId, canApprove, guardControls, series, sections, recentMedia, initial }: Props) {
  const router = useRouter();
  const versionRef = useRef(initial?.version ?? 0);
  const [revisionOf, setRevisionOf] = useState(initial?.revisionOf ?? null);
  const [id, setId] = useState(initial?.id ?? "");
  const [savedIdentity, setSavedIdentity] = useState(initial ? { id: initial.revisionOf ?? initial.id, section: initial.section, slug: initial.slug } : null);
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
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [seoBusy, setSeoBusy] = useState(false);
  const [metadataBusy, setMetadataBusy] = useState(false);
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
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const saveLock = useRef(false);
  const saveId = useRef(initial?.id ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardSequence = useRef(0);
  const richRef = useRef<RichBodyHandle | null>(null);
  const imageFileRef = useRef<HTMLInputElement | null>(null);
  const fullAbort = useRef<AbortController | null>(null);
  const draftRevision = useRef(0);
  const fullStartRevision = useRef(0);

  const recoverySnapshot = { title, excerpt, body, section, slug, seriesSlug, image, format, seoTitle, seoDescription, keywords, videoUrl, pinned, breakingUntil };
  const recovery = useDraftRecovery(`alelm-editor:${actorId}:${id || "new"}`, recoverySnapshot);
  const autosave = useDraftAutosave({
    snapshot: recoverySnapshot,
    enabled: recovery.ready && !recovery.recovery && !busy && !workflowBusy && status === "draft"
      && Boolean(id || title.trim() || stripHtmlToText(body).trim()) && (format !== "videos" || Boolean(normalizeVideoUrl(videoUrl))),
    onSave: () => save(true),
  });
  function restoreLocalDraft() {
    const value = recovery.recovery;
    if (!value) return;
    markDraftChanged();
    setTitle(value.title); setExcerpt(value.excerpt); setBody(value.body);
    richRef.current?.setHtml(value.body);
    setSection(value.section); setSlug(value.slug); setSeriesSlug(value.seriesSlug);
    setImage(value.image); setFormat(value.format); setSeoTitle(value.seoTitle);
    setSeoDescription(value.seoDescription); setKeywords(value.keywords); setVideoUrl(value.videoUrl);
    setPinned(value.pinned ?? false); setBreakingUntil(value.breakingUntil ?? null);
    recovery.dismiss();
    scheduleGuard(value.title, stripHtmlToText(value.body), value.image, value.format);
  }

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
    setImageUploadMessage(
      guardControls.requireImageRights
        ? "رُفعت واختيرت للمادة — يلزم توثيق الحقوق قبل الاعتماد."
        : "رُفعت واختيرت للمادة — اشتراط توثيق الحقوق معطّل حاليًا.",
    );
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
    if (fullBusy || metadataBusy) return;
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

  function applyMetadata(data: MetadataResult) {
    markDraftChanged();
    setExcerpt(data.excerpt.text);
    setSeoTitle(data.seo.seoTitle);
    setSeoDescription(data.seo.seoDescription);
    setKeywords(data.seo.keywords);
    setSeriesSlug(data.classify.seriesSlug);
    if (!initial?.publishedAt && !revisionOf && status === "draft") setSection(data.classify.section);
    setFormat(data.classify.format);
    scheduleGuard(title, bodyText(), image, data.classify.format);
    setMessage({ kind: "ok", text: "اعتُمدت الملحقات في المسودة. تابع حالة الحفظ على الخادم." });
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

  async function save(automatic = false): Promise<string | null> {
    if (saveLock.current || (automatic && workflowBusy)) return null;
    if (format === "videos" && !normalizeVideoUrl(videoUrl)) {
      setInspectorTab("details");
      setMessage({ kind: "err", text: "أدخل رابط يوتيوب أو تغريدة من X صحيحًا لإكمال المادة المرئية." });
      return null;
    }
    const savedSnapshot = { ...recoverySnapshot, body: richRef.current?.getHtml() ?? body };
    saveLock.current = true;
    // معرّف ثابت لأول محاولة؛ إعادة الطلب بعد فقدان الاستجابة لا تنشئ مادة مكررة.
    saveId.current ||= crypto.randomUUID();
    setBusy(true);
    if (!automatic) setMessage(null);
    try {
      const response = await fetch("/api/tahrir/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...savedSnapshot, id: saveId.current, expectedVersion: versionRef.current, autosave: automatic, image: image || null, videoUrl: videoUrl.trim() || null }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.id || typeof data.version !== "number") {
        throw new Error(data?.error ?? "تعذر الحفظ. بقيت تعديلاتك في المحرر؛ أعد محاولة حفظ المسودة.");
      }
      const confirmed = { ...savedSnapshot, slug: data.slug, section: data.section };
      // نقارن بالهوية التي أعادها الخادم، ولا نعتبر التعديلات أثناء الطلب محفوظة.
      recovery.markSaved(confirmed);
      autosave.markSaved(confirmed);
      versionRef.current = data.version;
      saveId.current = data.id;
      setSavedIdentity({ id: data.revisionOf ?? data.id, section: data.section, slug: data.slug });
      setRevisionOf(data.revisionOf);
      setStatus(data.status);
      setId(data.id);
      setBody(current => current === recoverySnapshot.body ? savedSnapshot.body : current);
      setSlug(current => current === savedSnapshot.slug ? data.slug : current);
      setSection(current => current === savedSnapshot.section ? data.section : current);
      window.history.replaceState(null, "", `/tahrir/editor/${data.id}`);
      setMessage(automatic ? null : { kind: "ok", text: data.revisionOf ? "حُفظت مسودة التعديل؛ النسخة المعتمدة باقية حتى النشر." : "حُفظت المسودة." });
      return data.id as string;
    } catch (cause) {
      autosave.markFailed();
      setMessage({ kind: "err", text: cause instanceof Error ? cause.message : "تعذر الحفظ. بقيت تعديلاتك في المحرر." });
      return null;
    } finally { saveLock.current = false; setBusy(false); }
  }

  async function submitForReview() {
    if (busy || workflowBusy || saveLock.current) return;
    setWorkflowBusy(true);
    try {
      const savedId = await save();
      if (!savedId) return;

      setBusy(true);
      const response = await fetch("/api/tahrir/story/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: savedId, expectedVersion: versionRef.current }),
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
      versionRef.current = data.version;
      setStatus("review");
      setMessage({ kind: "ok", text: "أُرسلت للاعتماد — بانتظار المعتمد البشري." });
    } finally { setWorkflowBusy(false); }
  }

  async function schedule() {
    if (busy || workflowBusy || saveLock.current) return;
    setWorkflowBusy(true);
    try {
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
        body: JSON.stringify({ id: savedId, expectedVersion: versionRef.current, scheduledAt: new Date(scheduleAt).toISOString() }),
      }).catch(() => null);
      setBusy(false);

      const data = await response?.json().catch(() => null);
      if (!response?.ok) {
        setMessage({ kind: "err", text: data?.error ?? "تعذرت الجدولة." });
        return;
      }
      versionRef.current = data.version;
      setStatus("scheduled");
      setMessage({ kind: "ok", text: "جُدولت — الحارس سيفحصها ثانية لحظة الموعد." });
    } finally { setWorkflowBusy(false); }
  }

  async function publish() {
    if (busy || workflowBusy || saveLock.current) return;
    setWorkflowBusy(true);
    try {
      const savedId = await save();
      if (!savedId) return;

      setBusy(true);
      const response = await fetch("/api/tahrir/story/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: savedId, expectedVersion: versionRef.current }),
      }).catch(() => null);
      setBusy(false);

      const data = await response?.json().catch(() => null);
      if (!response?.ok) {
        setMessage({ kind: "err", text: data?.error ?? "تعذر النشر." });
        return;
      }
      versionRef.current = data.version;
      setId(data.id);
      saveId.current = data.id;
      setRevisionOf(null);
      setStatus("published");
      setMessage({ kind: "ok", text: "نُشرت المادة على الموقع." });
      router.replace(`/tahrir/editor/${data.id}`);
      router.refresh();
    } finally { setWorkflowBusy(false); }
  }

  const titleWords = wordCount(title);
  const blocking = report?.counts.blocking ?? 0;
  const gateOpen = !guardBusy && report?.canRequestApproval === true;
  const allGatesDisabled = !guardControls.editorialGuard && !guardControls.requireImageRights;
  const rightsOnly = !guardControls.editorialGuard && guardControls.requireImageRights;
  const publicHref = status === "published" && id && slug ? `/${section}/${id}/${slug}` : null;

  return (
    <div className="flex flex-col gap-3">
      {recovery.recovery ? <Alert><AlertDescription>وجدنا نسخة محلية تختلف عن آخر نسخة على الخادم. راجعها قبل الاستعادة. <Button variant="outline" onClick={restoreLocalDraft}>استعادة كتابتي</Button> <Button variant="ghost" onClick={() => recovery.dismiss()}>تجاهل النسخة</Button></AlertDescription></Alert> : null}
      {recovery.unavailable ? <Alert><AlertDescription>الحفظ الاحتياطي المحلي غير متاح في هذا المتصفح؛ تابع مؤشر الحفظ على الخادم قبل المغادرة.</AlertDescription></Alert> : null}
      {revisionOf ? <Alert><AlertDescription>مسودة تعديل على مادة معتمدة. لن تتغير النسخة العامة حتى اعتماد هذه المسودة ونشرها.</AlertDescription></Alert> : null}
      <Card className="sticky top-[calc(var(--header-height)+0.5rem)] z-30 gap-0 py-0 shadow-md">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="text-[11px] text-muted-foreground">{initial ? "تحرير المادة" : "مادة جديدة"}</span>
          <StatusPill status={status} label={STATUS_LABELS[status] ?? status} />
          <span role="status" aria-live="polite" className={cn("text-[11px]", autosave.state === "error" ? "text-destructive" : "text-muted-foreground")}>
            {busy ? "جارٍ الحفظ على الخادم…" : autosave.state === "error" ? "لم يُحفظ على الخادم — أعد الحفظ يدويًا" : recovery.recovery ? "الحفظ التلقائي متوقف حتى مراجعة النسخة المحلية" : status !== "draft" ? "الحفظ التلقائي للمسودات؛ احفظ التعديل يدويًا" : autosave.dirty ? "تعديلات غير محفوظة — تُحفظ تلقائيًا بعد توقف الكتابة" : autosave.savedAt ? `محفوظ على الخادم · ${autosave.savedAt.toLocaleTimeString("ar-SA-u-ca-gregory-nu-latn", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : id ? "محفوظ على الخادم" : "الحفظ التلقائي على الخادم مفعّل"}
          </span>
          <span title={allGatesDisabled ? "فحص السياسة التحريرية واشتراط توثيق حقوق الصور معطّلان من إعدادات النظام. النشر يظل متاحًا لمن يملك الصلاحية." : undefined} className={cn("inline-flex items-center gap-1.5 border-s ps-2 text-xs", allGatesDisabled ? "text-(--t-warn)" : gateOpen ? "text-(--t-ok)" : guardBusy ? "text-muted-foreground" : "text-(--t-block)")}>
            <ShieldCheckIcon className="size-3.5" />
            {allGatesDisabled
              ? "فحوصات النشر الآلية معطّلة"
              : guardBusy
                ? rightsOnly ? "يفحص حقوق الصورة…" : "يفحص الحارس…"
                : gateOpen
                  ? rightsOnly ? "حقوق الصورة سليمة" : "جاهزة للاعتماد"
                  : `${blocking} مخالفة قاطعة`}
          </span>
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            {publicHref ? (
              <Button asChild size="sm" variant="ghost">
                <Link href={publicHref} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon data-icon="inline-start" />
                  <span className="hidden sm:inline">عرض على الموقع</span>
                </Link>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => void save()} disabled={busy || workflowBusy}>
              <SaveIcon data-icon="inline-start" />
              {busy ? "يحفظ…" : status === "published" ? "تحديث المادة" : "حفظ المسودة"}
            </Button>
            {status !== "published" && status !== "archived" ? (
              <Button size="sm" variant="secondary" onClick={submitForReview} disabled={!gateOpen || busy || workflowBusy} title={gateOpen ? undefined : "البوابة مغلقة حتى يكتمل الحارس بلا مخالفة قاطعة"}>
                <SendIcon data-icon="inline-start" className="rtl:-scale-x-100" />
                إرسال للاعتماد
              </Button>
            ) : null}
            {canApprove && status !== "published" && status !== "archived" ? (
              <Button size="sm" className="font-display font-bold" onClick={publish} disabled={!gateOpen || busy || workflowBusy} title={gateOpen ? undefined : "النشر يعلّق حتى تُحل المخالفات القاطعة"}>
                اعتماد ونشر
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* حقل الرفع المخفي يعيش هنا مع منطق الرفع؛ اللوحة تطلبه بنقرة فقط. */}
      <input
        ref={imageFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => void uploadStoryImage(event.target.files)}
      />

      {message ? (
        <Alert variant={message.kind === "err" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="grid gap-2 px-5 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <label htmlFor="story-title" className="text-xs font-semibold text-foreground">العنوان</label>
              <span className={cn("text-[10.5px] tabular-nums", titleWords > 10 ? "text-(--t-block)" : "text-muted-foreground")}>{titleWords} من 10 كلمات</span>
            </div>
            <Textarea
              id="story-title"
              placeholder="عنوان المادة…"
              rows={1}
              value={title}
              onChange={(event) => onTitle(event.target.value)}
              onInput={autoGrow}
              ref={autoGrowOnMount}
              className="min-h-20 resize-none overflow-hidden rounded-lg border-input bg-muted/20 px-3.5 py-3 font-display text-[22px] leading-relaxed font-bold text-foreground shadow-none placeholder:font-normal placeholder:text-muted-foreground/55 focus-visible:bg-background focus-visible:ring-2 md:text-[22px] dark:bg-muted/20"
            />
            <FieldGenerator tool="headlines" getDraft={() => ({ title, body: bodyText(), revision: draftRevision.current })} onApply={onTitle} disabled={fullBusy || busy} />
          </div>
          <div className="grid gap-2 border-t px-5 py-4">
            <div className="flex items-center justify-between">
              <label htmlFor="story-excerpt" className="text-xs font-semibold text-foreground">الموجز — قبل القراءة</label>
              <span className={cn("text-[10.5px] tabular-nums", excerpt.length > 180 ? "text-(--t-block)" : "text-muted-foreground")}>{excerpt.length} من 180 حرفًا</span>
            </div>
            <Textarea
              id="story-excerpt"
              placeholder="اكتب خلاصة المادة في سطر أو سطرين…"
              maxLength={220}
              rows={2}
              value={excerpt}
              onChange={(event) => {
                markDraftChanged();
                setExcerpt(event.target.value);
              }}
              className="min-h-22 resize-none rounded-lg border-input bg-muted/20 px-3.5 py-3 text-[14px] leading-relaxed text-foreground shadow-none placeholder:text-muted-foreground/55 focus-visible:bg-background focus-visible:ring-2 dark:bg-muted/20"
            />
            <FieldGenerator tool="excerpt" getDraft={() => ({ title, body: bodyText(), revision: draftRevision.current })} onApply={(text) => { markDraftChanged(); setExcerpt(text); }} disabled={fullBusy || busy} />
          </div>

          {!fullBusy && !fullEdit ? <FullEditBar onStart={runFullEdit} disabled={metadataBusy || busy || workflowBusy}>
            <MetadataGenerator disabled={fullBusy || busy || workflowBusy} lockedSection={initial?.publishedAt || revisionOf || status !== "draft" ? section : null} getDraft={() => ({ title, body: bodyText(), revision: draftRevision.current })} onApply={applyMetadata} onBusyChange={setMetadataBusy} sections={sections} series={series} formats={FORMATS} />
          </FullEditBar> : null}
          {fullBusy ? <FullEditProgressView progress={fullProgress} elapsed={fullElapsed} onStop={stopFullEdit} /> : null}
          {fullEdit ? (
            <FullEditProposal
              fullEdit={fullEdit}
              stale={fullEditStale}
              onApply={applyFullEdit}
              onRerun={runFullEdit}
              onDismiss={() => setFullEdit(null)}
            />
          ) : null}

          <ArticleLinks identity={savedIdentity} editorId={id} published={status === "published" || Boolean(initial?.publishedAt)} dirty={autosave.dirty || busy} />
          <RichBody ref={richRef} initial={initial?.body ?? ""} onChange={(html, text) => onBody(html, text)} />
        </Card>

        <Card dir="rtl" className="gap-0 overflow-hidden py-0 text-right xl:sticky xl:top-[calc(var(--header-height)+3.75rem)]">
          <Tabs dir="rtl" value={inspectorTab} onValueChange={(value) => setInspectorTab(value as InspectorTab)}>
            <div className="border-b p-2">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">التفاصيل</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
                <TabsTrigger value="guard" className="gap-1.5">
                  الحارس
                  {report?.findings.length ? (
                    <span className={cn("inline-grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white tabular-nums", blocking > 0 ? "bg-(--t-block)" : "bg-(--t-warn)")}>
                      {report.findings.length}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="ai">الذكاء</TabsTrigger>
              </TabsList>
            </div>
            <div className="max-h-[calc(100vh-var(--header-height)-7rem)] overflow-y-auto">
              <TabsContent value="details">
                <DetailsPanel
                  id={id}
                  identityLocked={Boolean(initial?.publishedAt || revisionOf || status !== "draft")}
                  title={title}
                  status={status}
                  canApprove={canApprove}
                  gateOpen={gateOpen}
                  busy={busy || workflowBusy}
                  formats={FORMATS}
                  format={format}
                  onFormat={(value) => {
                    markDraftChanged();
                    setFormat(value);
                    scheduleGuard(title, bodyText(), image, value);
                  }}
                  series={series}
                  seriesSlug={seriesSlug}
                  onSeries={(value) => {
                    markDraftChanged();
                    setSeriesSlug(value);
                  }}
                  sections={sections}
                  section={section}
                  onSection={(value) => {
                    markDraftChanged();
                    setSection(value);
                  }}
                  image={image}
                  onImage={(value) => {
                    setImage(value);
                    if (!value) setImageUploadMessage("");
                    scheduleGuard(title, bodyText(), value, format);
                  }}
                  onPickImage={() => imageFileRef.current?.click()}
                  imageUploadBusy={imageUploadBusy}
                  imageUploadMessage={imageUploadMessage}
                  requireImageRights={guardControls.requireImageRights}
                  recentMedia={recentMedia}
                  slug={slug}
                  onSlug={setSlug}
                  videoUrl={videoUrl}
                  onVideoUrl={(value) => {
                    markDraftChanged();
                    setVideoUrl(value);
                  }}
                  pinned={pinned}
                  onPinned={setPinned}
                  breakingUntil={breakingUntil}
                  onBreaking={setBreakingUntil}
                  scheduleAt={scheduleAt}
                  onScheduleAt={setScheduleAt}
                  onSchedule={schedule}
                  onArchived={() => {
                    window.location.reload();
                    setStatus("archived");
                    setArchiveEvent({ at: new Date().toISOString(), actor: "", reason: "أُرشفت من المحرر" });
                  }}
                  onRestored={() => {
                    window.location.reload();
                    setStatus("draft");
                    setArchiveEvent(null);
                  }}
                />
              </TabsContent>
              <TabsContent value="seo">
                <SeoPanel
                  seoTitle={seoTitle}
                  seoDescription={seoDescription}
                  keywords={keywords}
                  busy={seoBusy}
                  onSeoTitle={(value) => {
                    markDraftChanged();
                    setSeoTitle(value);
                  }}
                  onSeoDescription={(value) => {
                    markDraftChanged();
                    setSeoDescription(value);
                  }}
                  onAddKeyword={addKeyword}
                  onRemoveKeyword={(value) => {
                    markDraftChanged();
                    setKeywords(keywords.filter((item) => item !== value));
                  }}
                  onGenerate={generateSeo}
                />
              </TabsContent>
              <TabsContent value="guard">
                <GuardPanel
                  report={report}
                  guardBusy={guardBusy}
                  gateOpen={gateOpen}
                  controls={guardControls}
                  onFix={applyFix}
                  onLocate={(finding) => {
                    if (finding.excerpt && !richRef.current?.locate(finding.excerpt)) {
                      setMessage({ kind: "err", text: "لم يُعثر على الموضع في المتن — ربما في العنوان أو الموجز." });
                    }
                  }}
                  status={status}
                  archiveEvent={archiveEvent}
                />
              </TabsContent>
              <TabsContent value="ai">
                <AiPanel
                  guardEnabled={guardControls.editorialGuard}
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
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
