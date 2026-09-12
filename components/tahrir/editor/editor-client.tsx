"use client";

import { EXCERPT_MAX_CHARS, excerptLength } from "@/lib/content/excerpt";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { MetadataResult, SeoResult } from "@/lib/ai/editorial";
import { stripHtmlToText } from "@/lib/content/html";
import { normalizeVideoUrl } from "@/lib/content/video";
import type { Finding } from "@/lib/policy/types";
import type { GuardControls } from "@/lib/policy";
import { applyTextPreservingFormatting, formattingLoss } from "@/lib/tahrir/editor/preserve-formatting";
import { describeRecoveryDiff, recoveryDiffLabel } from "@/lib/tahrir/editor/recovery-diff";
import { isoToRiyadhWallTime, riyadhWallTimeToIso } from "@/lib/tahrir/riyadh-time";
import { cn } from "@/lib/utils";
import { uploadStoryImageFile } from "@/lib/story-image-upload";

import { useDraftRecovery, useDraftTabToken } from "@/components/tahrir/use-draft-recovery";
import { useDraftAutosave } from "@/components/tahrir/use-draft-autosave";

import { TeamPanel, EditorPresence } from "./team-panel";
import { ActionBar } from "./action-bar";
import { AiPanel } from "./ai-panel";
import { FieldGenerator } from "./field-generator";
import { MetadataGenerator } from "./metadata-generator";
import { ArticleLinks } from "./article-links";
import { DetailsPanel } from "./details-panel";
import { FullEditBar, FullEditProgressView, FullEditProposal } from "./full-edit";
import { GuardPanel } from "./guard-panel";
import { RichBody, type RichBodyHandle } from "./rich-body";
import { SeoPanel } from "./seo-panel";
import { useFullEditStream, type EditorMessage } from "./use-full-edit-stream";
import { useLiveGuard } from "./use-live-guard";
import { useStoryWorkflow, type StorySnapshot } from "./use-story-workflow";

/** تبويب المفتّش: خلفية مداد واضحة للحالة النشطة في الوضعين. */
const INSPECTOR_TAB = "editor-inspector-tab data-[state=active]:shadow-none";

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
  scheduledAt?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
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
  canSchedule?: boolean;
  canPin?: boolean;
  canSubmit?: boolean;
  /** رابط سجل النسخ واستعادتها — يظهر في شريط الإجراءات بجانب السجل الزمني. */
  historyHref?: string | null;
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
 * محرر المادة — الحالة والتركيب هنا؛ المنطق في ثلاثة خطافات مجاورة:
 * use-story-workflow (الحفظ وسير الاعتماد)، use-live-guard (الحارس الحي)، use-full-edit-stream (التحرير الشامل).
 * الواجهة على shadcn: شريط إجراءات لاصق، متن Tiptap، ومفتّش جانبي بأربعة تبويبات.
 */
export function EditorClient({ actorId, canApprove, canSchedule = false, canPin = canApprove, canSubmit = true, historyHref = null, guardControls, series, sections, recentMedia, initial }: Props) {
  const router = useRouter();
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
  const [scheduleAt, setScheduleAt] = useState(() => isoToRiyadhWallTime(initial?.scheduledAt));
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [archiveEvent, setArchiveEvent] = useState(initial?.archiveEvent ?? null);
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? "");
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? []);
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(initial?.updatedAt ?? null);
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const [imageUploadMessage, setImageUploadMessage] = useState("");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("details");
  const [message, setMessage] = useState<EditorMessage>(null);
  const [confirmStaleRestore, setConfirmStaleRestore] = useState(false);
  const richRef = useRef<RichBodyHandle | null>(null);
  const imageFileRef = useRef<HTMLInputElement | null>(null);

  const bodyText = () => richRef.current?.getText() ?? stripHtmlToText(body);
  const bodyHtml = () => richRef.current?.getHtml() ?? body;

  const guard = useLiveGuard({ title, body, image, format, breakingUntil });
  const full = useFullEditStream({ setMessage });

  const recoverySnapshot: StorySnapshot = { title, excerpt, body, section, slug, seriesSlug, image, format, seoTitle, seoDescription, keywords, videoUrl, pinned, breakingUntil };
  const tabToken = useDraftTabToken();

  const workflow = useStoryWorkflow({
    canSchedule,
    router,
    initialId: initial?.id ?? "",
    initialVersion: initial?.version ?? 0,
    status,
    canApprove,
    setMessage,
    getSnapshot: () => ({ ...recoverySnapshot, body: bodyHtml() }),
    validate: () => {
      if (format === "videos" && !normalizeVideoUrl(videoUrl)) {
        setInspectorTab("details");
        return "أدخل رابط يوتيوب أو تغريدة X أو فيديو/ريلز إنستقرام صحيحًا لإكمال المادة المرئية.";
      }
      return null;
    },
    onSaved: (data, saved) => {
      const confirmed = { ...saved, slug: data.slug, section: data.section };
      // نقارن بالهوية التي أعادها الخادم، ولا نعتبر التعديلات أثناء الطلب محفوظة.
      recovery.markSaved(confirmed);
      autosave.markSaved(confirmed);
      setLastUpdatedAt(new Date().toISOString());
      setSavedIdentity({ id: data.revisionOf ?? data.id, section: data.section, slug: data.slug });
      setRevisionOf(data.revisionOf);
      setStatus(data.status);
      if (data.scheduledAt) setScheduleAt(isoToRiyadhWallTime(data.scheduledAt));
      setId(data.id);
      setBody(current => current === recoverySnapshot.body ? saved.body : current);
      setSlug(current => current === saved.slug ? data.slug : current);
      setSection(current => current === saved.section ? data.section : current);
    },
    onSaveFailed: () => autosave.markFailed(),
    onSubmitted: () => setStatus("review"),
    onScheduled: () => setStatus("scheduled"),
    onPublished: (data) => {
      recovery.clear();
      setId(data.id);
      setRevisionOf(null);
      setStatus("published");
    },
    onGuardRejected: async () => {
      await guard.retryGuard({ body: bodyHtml() });
      setInspectorTab("guard");
    },
    getScheduleAt: () => (scheduleAt ? riyadhWallTimeToIso(scheduleAt) ?? "" : ""),
  });
  const { busy, workflowBusy } = workflow;

  const recovery = useDraftRecovery(`alelm-editor:${actorId}:${id || tabToken}`, recoverySnapshot, { version: workflow.serverVersion, updatedAt: lastUpdatedAt });
  const autosave = useDraftAutosave({
    snapshot: recoverySnapshot,
    enabled: recovery.ready && !recovery.recovery && !busy && !workflowBusy && status === "draft"
      && Boolean(id || title.trim() || stripHtmlToText(body).trim()) && (format !== "videos" || Boolean(normalizeVideoUrl(videoUrl))),
    onSave: () => workflow.save(true),
  });
  const recoveryDiff = recovery.recovery
    ? describeRecoveryDiff(
        { title: initial?.title ?? "", excerpt: initial?.excerpt ?? "", body: initial?.body ?? "" },
        { title: recovery.recovery.title, excerpt: recovery.recovery.excerpt, body: recovery.recovery.body },
      )
    : null;

  function restoreLocalDraft() {
    const value = recovery.recovery;
    if (!value) return;
    if (recovery.recoveryMeta?.stale && !confirmStaleRestore) {
      setConfirmStaleRestore(true);
      return;
    }
    markDraftChanged();
    setTitle(value.title); setExcerpt(value.excerpt); setBody(value.body);
    richRef.current?.setHtml(value.body);
    setSection(value.section); setSlug(value.slug); setSeriesSlug(value.seriesSlug);
    setImage(value.image); setFormat(value.format); setSeoTitle(value.seoTitle);
    setSeoDescription(value.seoDescription); setKeywords(value.keywords); setVideoUrl(value.videoUrl);
    setPinned(value.pinned ?? false); setBreakingUntil(value.breakingUntil ?? null);
    setConfirmStaleRestore(false);
    recovery.dismiss();
    guard.scheduleGuard({ title: value.title, body: value.body, image: value.image, format: value.format, breakingUntil: value.breakingUntil ?? null });
  }

  function markDraftChanged() {
    full.markDraftChanged();
  }

  function onTitle(value: string) {
    markDraftChanged();
    setTitle(value);
    guard.scheduleGuard({ title: value, body: bodyHtml() });
  }

  function onBody(html: string) {
    markDraftChanged();
    setBody(html);
    guard.scheduleGuard({ title, body: html });
  }

  function applyFix(finding: Finding) {
    if (!finding.autofix) return;
    const { field, from, to } = finding.autofix;
    if (field === "title") {
      onTitle(title.replace(from, to));
      return;
    }
    // المتن: استبدال على مستوى عقد النص أولًا فتبقى الروابط والعلامات، ثم على HTML إن وُجد النص متصلًا فيه.
    if (richRef.current?.replaceText(from, to)) return;
    if (body.includes(from)) {
      richRef.current?.setHtml(body.replace(from, to));
      return;
    }
    setMessage({ kind: "err", text: "تعذر الإصلاح آليًا — العبارة غير متصلة في المتن. انتقل للموضع وعدّلها يدويًا." });
  }

  /** استبدال المتن كاملًا بنص من الذكاء مع الحفاظ على الروابط والعناوين المطابقة والتغريدات. */
  function replaceBodyPreservingFormatting(text: string) {
    richRef.current?.setHtml(applyTextPreservingFormatting(bodyHtml(), text));
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

    try {
      const data = await uploadStoryImageFile(file, (percent) => {
        setImageUploadMessage(percent === null ? "اكتمل إرسال الصورة — جارٍ تأكيد حفظها…" : `جارٍ رفع الصورة… ${percent}%`);
      });
      markDraftChanged();
      setImage(data.url);
      guard.scheduleGuard({ image: data.url, body: bodyHtml() });
      setImageUploadMessage(
        guardControls.requireImageRights
          ? "رُفعت واختيرت للمادة — يلزم توثيق الحقوق قبل الاعتماد."
          : "رُفعت واختيرت للمادة — اشتراط توثيق الحقوق معطّل حاليًا.",
      );
    } catch (error) {
      setImageUploadMessage(error instanceof Error ? error.message : "تعذر رفع الصورة. حاول مرة أخرى.");
    } finally {
      setImageUploadBusy(false);
      // Reset after failure too: selecting the same file must fire change again.
      if (imageFileRef.current) imageFileRef.current.value = "";
    }
  }

  function applySeo(seo: Pick<SeoResult, "seoTitle" | "seoDescription" | "keywords">) {
    markDraftChanged();
    setSeoTitle(seo.seoTitle);
    setSeoDescription(seo.seoDescription);
    setKeywords(seo.keywords);
    setMessage({ kind: "ok", text: "اعتُمدت حزمة SEO في المسودة. تابع حالة الحفظ على الخادم." });
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
    guard.scheduleGuard({ body: bodyHtml(), format: data.classify.format });
    setMessage({ kind: "ok", text: "اعتُمدت الملحقات في المسودة. تابع حالة الحفظ على الخادم." });
  }

  function applyFullEdit() {
    const fullEdit = full.fullEdit;
    if (!fullEdit || full.fullEditStale) return;
    replaceBodyPreservingFormatting(fullEdit.body.text);
    onTitle(fullEdit.title.text);
    setExcerpt(fullEdit.excerpt.text);
    setSeoTitle(fullEdit.seo.seoTitle);
    setSeoDescription(fullEdit.seo.seoDescription);
    setKeywords(fullEdit.seo.keywords);
    if (fullEdit.classify.seriesSlug) setSeriesSlug(fullEdit.classify.seriesSlug);
    setSection(fullEdit.classify.section);
    setFormat(fullEdit.classify.format);
    guard.scheduleGuard({ title: fullEdit.title.text, body: bodyHtml(), format: fullEdit.classify.format });
    full.clearFullEdit();
    setMessage({ kind: "ok", text: "طُبّق التحرير الشامل — راجع ثم احفظ؛ لا يُنشر شيء آليًا." });
  }

  const getDraft = () => ({ storyId: id || undefined, title, body: bodyText(), revision: full.revision() });
  const titleWords = wordCount(title);
  const blocking = guard.report?.counts.blocking ?? 0;
  const gateOpen = guard.gateOpen;
  const publicHref = status === "published" && id && slug ? `/${section}/${id}/${slug}` : null;
  const fullEditLoss = full.fullEdit ? formattingLoss(body, full.fullEdit.body.text) : null;

  return (
    <div className="tahrir-editor flex flex-col gap-3">
      <EditorPresence key={`presence:${id}`} id={id || null} />
      {recovery.recovery ? (
        <Alert variant={recovery.recoveryMeta?.stale ? "destructive" : "default"}>
          <AlertDescription>
            <div className="grid gap-2">
              <span>
                {recovery.recoveryMeta?.stale
                  ? "حُفظت نسخة أحدث على الخادم بعد كتابتك — قارن قبل الاستعادة."
                  : "وجدنا نسخة محلية تختلف عن آخر نسخة على الخادم. راجعها قبل الاستعادة."}
                {recoveryDiff ? <span className="text-xs"> ({recoveryDiffLabel(recoveryDiff)})</span> : null}
              </span>
              {recovery.recoveryMeta?.stale ? (
                <span className="text-xs">
                  النسخة المحلية كُتبت على الإصدار {recovery.recoveryMeta.storedVersion ?? "؟"} والمفتوح الآن الإصدار {recovery.recoveryMeta.currentVersion}؛ الاستعادة تستبدل ما على الشاشة ولا تمس الخادم حتى تحفظ.
                </span>
              ) : null}
              <span className="flex flex-wrap gap-1.5">
                <Button variant="outline" onClick={restoreLocalDraft}>
                  {recovery.recoveryMeta?.stale ? (confirmStaleRestore ? "أؤكد الاستعادة فوق النسخة الأحدث" : "استعادة كتابتي رغم التعارض") : "استعادة كتابتي"}
                </Button>
                <Button variant="ghost" onClick={() => { setConfirmStaleRestore(false); recovery.dismiss(); }}>تجاهل النسخة</Button>
              </span>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      {recovery.unavailable ? <Alert><AlertDescription>الحفظ الاحتياطي المحلي غير متاح في هذا المتصفح؛ تابع مؤشر الحفظ على الخادم قبل المغادرة.</AlertDescription></Alert> : null}
      {revisionOf ? <Alert><AlertDescription>مسودة تعديل على مادة معتمدة. لن تتغير النسخة العامة حتى اعتماد هذه المسودة ونشرها.</AlertDescription></Alert> : null}
      <ActionBar
        isNew={!initial}
        id={id}
        status={status}
        canApprove={canApprove}
        canSchedule={canSchedule}
        canSubmit={canSubmit}
        historyHref={historyHref}
        busy={busy}
        workflowBusy={workflowBusy}
        navigating={workflow.navigating.current}
        autosave={{ state: autosave.state, dirty: autosave.dirty, savedAt: autosave.savedAt }}
        recoveryPending={Boolean(recovery.recovery)}
        lastUpdatedAt={lastUpdatedAt}
        guardBusy={guard.guardBusy}
        guardError={guard.guardError}
        gateOpen={gateOpen}
        blocking={blocking}
        guardControls={guardControls}
        publicHref={publicHref}
        getPreview={() => ({ title, excerpt, body: bodyHtml(), image, section: sections.find(([key]) => key === section)?.[1] ?? section })}
        onSave={workflow.saveManually}
        onSubmit={workflow.submitForReview}
        onPublish={workflow.publish}
        onReturnToDraft={workflow.returnToDraft}
        onRetryGuard={() => void guard.retryGuard({ body: bodyHtml() })}
      />

      <TeamPanel key={`team:${id}`} id={id || null} status={status} locked={busy || workflowBusy || status === "archived"} dirty={autosave.dirty} getVersion={() => workflow.versionRef.current} onVersion={workflow.setVersion} onReturn={workflow.returnToStories} />

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
        {/* clip يحافظ على الزوايا دون إنشاء حاوية تمرير تعطل تثبيت أدوات التنسيق. */}
        <Card className="editor-paper min-w-0 gap-0 overflow-clip py-0" data-tour="paper">
          <div className="editor-writing-field grid gap-2 px-5 pt-5 pb-4">
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
              className="min-h-20 resize-none overflow-hidden rounded-lg border-input bg-background px-3.5 py-3 font-display text-[22px] leading-relaxed font-bold text-foreground shadow-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:bg-card focus-visible:ring-2 md:text-[22px]"
            />
            <FieldGenerator tool="headlines" getDraft={getDraft} onApply={onTitle} disabled={full.fullBusy || busy} />
          </div>
          <div className="editor-writing-field grid gap-2 border-t px-5 py-4">
            <div className="flex items-center justify-between">
              <label htmlFor="story-excerpt" className="text-xs font-semibold text-foreground">الموجز — قبل القراءة</label>
              <span className={cn("text-[10.5px] tabular-nums", excerptLength(excerpt) > EXCERPT_MAX_CHARS ? "text-(--t-block)" : "text-muted-foreground")}>{excerptLength(excerpt)} من {EXCERPT_MAX_CHARS} حرفًا</span>
            </div>
            <Textarea
              id="story-excerpt"
              placeholder="اكتب خلاصة المادة في سطر أو سطرين…"
              maxLength={EXCERPT_MAX_CHARS}
              rows={2}
              value={excerpt}
              onChange={(event) => {
                markDraftChanged();
                setExcerpt(event.target.value);
              }}
              className="min-h-22 resize-none rounded-lg border-input bg-background px-3.5 py-3 text-[14px] leading-relaxed text-foreground shadow-none placeholder:text-muted-foreground focus-visible:bg-card focus-visible:ring-2"
            />
            <FieldGenerator tool="excerpt" getDraft={getDraft} onApply={(text) => { markDraftChanged(); setExcerpt(text); }} disabled={full.fullBusy || busy} />
          </div>

          {!full.fullBusy && !full.fullEdit ? <FullEditBar onStart={() => void full.runFullEdit({ storyId: id || undefined, title, body: bodyText() })} disabled={metadataBusy || busy || workflowBusy}>
            <MetadataGenerator disabled={full.fullBusy || busy || workflowBusy} lockedSection={initial?.publishedAt || revisionOf || status !== "draft" ? section : null} getDraft={getDraft} onApply={applyMetadata} onBusyChange={setMetadataBusy} sections={sections} series={series} formats={FORMATS} />
          </FullEditBar> : null}
          {full.fullBusy ? <FullEditProgressView progress={full.fullProgress} elapsed={full.fullElapsed} onStop={full.stopFullEdit} /> : null}
          {full.fullEdit ? (
            <FullEditProposal
              fullEdit={full.fullEdit}
              stale={full.fullEditStale}
              bodyLoss={fullEditLoss}
              onApply={applyFullEdit}
              onRerun={() => void full.runFullEdit({ storyId: id || undefined, title, body: bodyText() })}
              onDismiss={full.clearFullEdit}
            />
          ) : null}

          <ArticleLinks identity={savedIdentity} editorId={id} published={status === "published" || Boolean(initial?.publishedAt)} dirty={autosave.dirty || busy} />
          <RichBody ref={richRef} initial={initial?.body ?? ""} onChange={(html) => onBody(html)} />
        </Card>

        <Card dir="rtl" data-tahrir-panel className="editor-inspector gap-0 overflow-hidden bg-(--t-panel) py-0 text-start xl:sticky xl:top-[calc(var(--header-height)+3.75rem)]">
          <Tabs value={inspectorTab} onValueChange={(value) => setInspectorTab(value as InspectorTab)}>
            <div className="editor-inspector-tabs border-b p-1.5">
              <TabsList className="grid w-full grid-cols-4 bg-transparent">
                <TabsTrigger value="details" className={INSPECTOR_TAB}>التفاصيل</TabsTrigger>
                <TabsTrigger value="seo" className={INSPECTOR_TAB}>SEO</TabsTrigger>
                <TabsTrigger value="guard" className={cn(INSPECTOR_TAB, "gap-1.5")}>
                  الحارس
                  {guard.report?.findings.length ? (
                    <span className={cn("inline-grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white tabular-nums", blocking > 0 ? "bg-(--t-block)" : "bg-(--t-warn)")}>
                      {guard.report.findings.length}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger data-tour="editor-ai" value="ai" className={INSPECTOR_TAB}>الذكاء</TabsTrigger>
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
                  canPin={canPin}
                  canSchedule={canSchedule}
                  gateOpen={gateOpen}
                  busy={busy || workflowBusy}
                  formats={FORMATS}
                  format={format}
                  onFormat={(value) => {
                    markDraftChanged();
                    setFormat(value);
                    guard.scheduleGuard({ body: bodyHtml(), format: value });
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
                    guard.scheduleGuard({ body: bodyHtml(), image: value });
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
                  onBreaking={(value) => {
                    setBreakingUntil(value);
                    // «عاجل» يغيّر قواعد الحارس (المصادر والسقف اليومي) فيُفحص فورًا كما على الخادم.
                    guard.scheduleGuard({ body: bodyHtml(), breakingUntil: value });
                  }}
                  scheduleAt={scheduleAt}
                  onScheduleAt={setScheduleAt}
                  onSchedule={workflow.schedule}
                  beforeArchive={() => {
                    if (autosave.dirty || busy || workflowBusy) {
                      toast.error("احفظ التعديلات أو انتظر اكتمال الحفظ قبل الأرشفة.");
                      return false;
                    }
                    return true;
                  }}
                  onArchived={() => {
                    recovery.clear();
                    setStatus("archived");
                    setArchiveEvent({ at: new Date().toISOString(), actor: "", reason: "أُرشفت من المحرر" });
                    workflow.returnToStories();
                  }}
                  onRestored={() => {
                    workflow.returnToStories();
                  }}
                />
              </TabsContent>
              <TabsContent value="seo">
                <SeoPanel
                  seoTitle={seoTitle}
                  seoDescription={seoDescription}
                  keywords={keywords}
                  disabled={full.fullBusy || busy || workflowBusy}
                  getDraft={getDraft}
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
                  onApply={applySeo}
                />
              </TabsContent>
              <TabsContent value="guard">
                <GuardPanel
                  report={guard.report}
                  guardBusy={guard.guardBusy}
                  guardError={guard.guardError}
                  gateOpen={gateOpen}
                  controls={guardControls}
                  onFix={applyFix}
                  onLocate={(finding) => {
                    if (finding.excerpt && !richRef.current?.locate(finding.excerpt)) {
                      setMessage({ kind: "err", text: "لم يُعثر على الموضع في المتن — ربما في العنوان أو الموجز." });
                    }
                  }}
                  onRetry={() => void guard.retryGuard({ body: bodyHtml() })}
                  status={status}
                  archiveEvent={archiveEvent}
                />
              </TabsContent>
              <TabsContent value="ai">
                <AiPanel
                  guardEnabled={guardControls.editorialGuard}
                  getDraft={() => ({
                    storyId: id || undefined,
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
                    else replaceBodyPreservingFormatting(text);
                  }}
                  describeBodyLoss={(text) => formattingLoss(bodyHtml(), text)}
                  onClassify={(c) => {
                    markDraftChanged();
                    if (c.seriesSlug) setSeriesSlug(c.seriesSlug);
                    setSection(c.section);
                    setFormat(c.format);
                    guard.scheduleGuard({ body: bodyHtml(), format: c.format });
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
