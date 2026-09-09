"use client";

import { useRef, useState } from "react";

import { newSaveId, saveStory, scheduleStory, transitionStory, type SavedStory } from "@/lib/tahrir/client/story-transport";

import type { EditorMessage } from "./use-full-edit-stream";

/** لقطة المادة كما تُرسل للحفظ وتُحفظ محليًا. */
export interface StorySnapshot {
  title: string;
  excerpt: string;
  body: string;
  section: string;
  slug: string;
  seriesSlug: string | null;
  image: string;
  format: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  videoUrl: string;
  pinned: boolean;
  breakingUntil: string | null;
}

export const SAVE_TIMEOUT_MESSAGE = "تعذر تأكيد الحفظ. بقيت تعديلاتك في المحرر؛ تحقق من آخر نسخة في تبويب آخر قبل إعادة المحاولة.";

interface Options {
  router: { replace(href: string): void; refresh(): void };
  initialId: string;
  initialVersion: number;
  status: string;
  canApprove: boolean;
  setMessage: (message: EditorMessage) => void;
  /** اللقطة الحالية بمتن المحرر الغني. */
  getSnapshot: () => StorySnapshot;
  /** فحص قبل الحفظ؛ رسالة خطأ تمنع الإرسال أو null. */
  validate: () => string | null;
  onSaved: (data: SavedStory, saved: StorySnapshot) => void;
  onSaveFailed: () => void;
  onSubmitted: (version: number) => void;
  onScheduled: (version: number) => void;
  onPublished: (data: { id: string; version: number }) => void;
  /** رفض الحارس (422) عند الإرسال: أعد الفحص وافتح تبويبه. */
  onGuardRejected: () => Promise<void>;
  /** موعد الجدولة ISO أو "" حين لم يُختر أو غير صالح. */
  getScheduleAt: () => string;
}

/**
 * سير المادة: الحفظ (يدوي/تلقائي)، الإرسال للاعتماد، الجدولة، النشر، التحويل إلى مسودة،
 * والعودة إلى القائمة — بقفل حفظ واحد ومعرّف ثابت لأول محاولة ونسخة الخادم المتوقعة.
 */
export function useStoryWorkflow(options: Options) {
  const { router, status, canApprove, setMessage } = options;
  const versionRef = useRef(options.initialVersion);
  const [serverVersion, setServerVersion] = useState(options.initialVersion);
  const [busy, setBusy] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const saveLock = useRef(false);
  const navigating = useRef(false);
  const saveId = useRef(options.initialId);

  /** يحدّث النسخة المعروفة من الخادم (من الحفظ أو من لوحة الفريق). */
  function setVersion(version: number) {
    versionRef.current = version;
    setServerVersion(version);
  }

  function returnToStories() {
    navigating.current = true;
    setWorkflowBusy(true);
    router.replace("/tahrir/stories");
    router.refresh();
  }

  async function save(automatic = false, returnToDraft = false): Promise<string | null> {
    if (saveLock.current || (automatic && workflowBusy)) return null;
    const invalid = options.validate();
    if (invalid) {
      setMessage({ kind: "err", text: invalid });
      return null;
    }
    const savedSnapshot = options.getSnapshot();
    saveLock.current = true;
    // معرّف ثابت لأول محاولة؛ إعادة الطلب بعد فقدان الاستجابة لا تنشئ مادة مكررة.
    saveId.current ||= newSaveId();
    setBusy(true);
    if (!automatic) setMessage(null);
    try {
      const result = await saveStory({
        ...savedSnapshot,
        id: saveId.current,
        expectedVersion: versionRef.current,
        autosave: automatic,
        returnToDraft,
        image: savedSnapshot.image || null,
        videoUrl: savedSnapshot.videoUrl.trim() || null,
      });
      if (!result.ok) {
        options.onSaveFailed();
        setMessage({ kind: "err", text: result.timedOut ? SAVE_TIMEOUT_MESSAGE : result.error });
        return null;
      }
      const data = result.data;
      setVersion(data.version);
      saveId.current = data.id;
      options.onSaved(data, savedSnapshot);
      window.history.replaceState(null, "", `/tahrir/editor/${data.id}`);
      setMessage(automatic ? null : { kind: "ok", text: data.revisionOf ? "حُفظت مسودة التعديل؛ النسخة المعتمدة باقية حتى النشر." : "حُفظت المسودة." });
      return data.id;
    } finally { saveLock.current = false; setBusy(false); }
  }

  async function saveManually() {
    if (busy || workflowBusy || saveLock.current) return;
    if (status === "published" && canApprove) return publish();
    const updatingPublishedStory = status === "published";
    setWorkflowBusy(true);
    try {
      if (await save() && updatingPublishedStory) returnToStories();
    } finally { if (!navigating.current) setWorkflowBusy(false); }
  }

  async function returnToDraft() {
    if (!canApprove || status !== "published" || busy || workflowBusy || saveLock.current) return;
    setWorkflowBusy(true);
    try {
      if (await save(false, true)) returnToStories();
    } finally { if (!navigating.current) setWorkflowBusy(false); }
  }

  async function submitForReview() {
    if (busy || workflowBusy || saveLock.current) return;
    setWorkflowBusy(true);
    try {
      const savedId = await save();
      if (!savedId) return;

      setBusy(true);
      const result = await transitionStory("submit", { id: savedId, expectedVersion: versionRef.current }, { fallback: "رفض الحارس الإرسال." });
      setBusy(false);

      if (!result.ok) {
        if (result.status === 422) await options.onGuardRejected();
        const blocking = result.body?.blocking;
        const blockingRules = Array.isArray(blocking) && blocking.length > 0 ? ` (${blocking.join("، ")})` : "";
        setMessage({ kind: "err", text: `${result.error}${blockingRules}` });
        return;
      }
      setVersion(result.data.version);
      options.onSubmitted(result.data.version);
      setMessage({ kind: "ok", text: "أُرسلت للاعتماد — بانتظار المعتمد البشري." });
    } finally { setWorkflowBusy(false); }
  }

  async function schedule() {
    if (busy || workflowBusy || saveLock.current) return;
    setWorkflowBusy(true);
    try {
      const scheduledAt = options.getScheduleAt();
      if (!scheduledAt) {
        setMessage({ kind: "err", text: "اختر موعد الجدولة أولًا." });
        return;
      }
      const savedId = await save();
      if (!savedId) return;

      setBusy(true);
      const result = await scheduleStory({ id: savedId, expectedVersion: versionRef.current, scheduledAt });
      setBusy(false);

      if (!result.ok) {
        setMessage({ kind: "err", text: result.error });
        return;
      }
      setVersion(result.data.version);
      options.onScheduled(result.data.version);
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
      const result = await transitionStory("publish", { id: savedId, expectedVersion: versionRef.current }, { fallback: "تعذر تأكيد النشر. تحقق من حالة المادة في تبويب آخر قبل إعادة المحاولة." });
      setBusy(false);

      if (!result.ok) {
        setMessage({ kind: "err", text: result.error });
        return;
      }
      const publishedId = typeof result.data.id === "string" ? result.data.id : savedId;
      setVersion(result.data.version);
      saveId.current = publishedId;
      options.onPublished({ id: publishedId, version: result.data.version });
      setMessage({ kind: "ok", text: "نُشرت المادة على الموقع." });
      returnToStories();
    } finally { if (!navigating.current) setWorkflowBusy(false); }
  }

  return {
    busy, workflowBusy, serverVersion, versionRef, saveId, navigating,
    setVersion, save, saveManually, returnToDraft, submitForReview, schedule, publish, returnToStories,
  };
}
