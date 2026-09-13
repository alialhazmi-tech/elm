"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useArticleState } from "@/app/_components/use-article-state";

import { SummaryListen } from "@/app/_components/summary-listen";
import { EndingPoll } from "@/app/_components/poll";
import { toLatinDigits } from "@/lib/format";

export function ArticleClosingPoll({
  storyId,
  question,
  options,
}: {
  storyId: string;
  question: string;
  options: Array<{ label: string }>;
}) {
  return <EndingPoll pollId={storyId} question={question} options={options} />;
}

export type RelatedCard = {
  id: string;
  href: string;
  title: string;
  excerpt: string;
  sectionLabel: string;
  image?: string;
  readingMinutes: number;
  reason?: { code: string; text: string };
};

const FLUSH_MS = 15_000;

function postJson(url: string, body: unknown, keepalive = false) {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive,
  });
}

/**
 * «احفظ المادة» في صف البايلاين — نفس مكتبة العضو خلف الواجهة
 * (`/api/me/saved`)، فالمحفوظ هنا هو المحفوظ في صفحة «لك».
 */
export function ArticleSaveButton({ storyId, joinHref }: { storyId: string; joinHref: string }) {
  const [state, setState, refreshState] = useArticleState(storyId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  if (state.status !== "ready") {
    const retry = async () => {
      await refreshState();
    };
    return <button type="button" className="sa-save" disabled={state.status === "loading"} onClick={() => void retry()}>
      {state.status === "loading" ? "جارٍ التحقق من الحساب…" : "إعادة التحقق للحفظ"}
    </button>;
  }
  if (state.saveLoginHref) return <Link className="sa-save" href={state.saveLoginHref}>أكمل تفعيل الحساب للحفظ</Link>;
  if (!state.saveOwnerId) {
    return (
      <Link className="sa-save" href={`${joinHref}&mode=signin`}>
        <span aria-hidden="true">☆</span> احفظ المادة
      </Link>
    );
  }

  const toggle = async () => {
    if (saving) return;
    setSaving(true); setSaveError("");
    const next = !state.saved;
    setState((current) => ({ ...current, saved: next }));
    try {
      const response = await postJson("/api/me/saved", { storyId, saved: next, expectedMemberId: state.saveOwnerId });
      if (!response.ok) throw new Error("save");
      const data = (await response.json()) as { saved?: boolean };
      const saved = Boolean(data.saved);
      setState((current) => current.saveOwnerId === state.saveOwnerId ? { ...current, saved } : current);
      window.dispatchEvent(new Event("alelm-saved-change"));
    } catch {
      setState((current) => current.saveOwnerId === state.saveOwnerId ? { ...current, saved: !next } : current);
      setSaveError("تعذر الحفظ. تحقق من الحساب والاتصال ثم أعد المحاولة.");
      await refreshState();
    } finally { setSaving(false); }
  };

  return (
    <button
      type="button"
      disabled={saving}
      title={saveError || undefined}
      className={state.saved ? "sa-save is-on" : "sa-save"}
      aria-pressed={state.saved}
      onClick={() => void toggle()}
    >
      <span aria-hidden="true">{state.saved ? "★" : "☆"}</span>
      {saveError ? "أعد محاولة الحفظ" : state.saved ? "محفوظة" : "احفظ المادة"}
    </button>
  );
}

/**
 * «✦ أدوات القارئ» — بطاقة واحدة تجمع ما كان مبعثرًا بين شريط الأدوات
 * و«اسأل عن المادة»: استمع، لخّص لي، مشاركة، نسخ الرابط، ثم حقل السؤال.
 * أدوات الذكاء تحتاج عضوية، فتتحول لغير الأعضاء إلى دعوة للانضمام.
 */
export function ArticleToolbar({
  storyId,
  title,
  joinHref,
  excerpt,
  shareUrl,
}: {
  storyId: string;
  title: string;
  joinHref: string;
  excerpt: string;
  shareUrl: string;
}) {
  const [state] = useArticleState(storyId);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState<string[] | null>(null);
  const [answer, setAnswer] = useState<string[] | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState<"summary" | "discuss" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** إجابات الأسئلة تُعرض كفقرات؛ الملخص له ثلاث نقاط صريحة من الخدمة. */
  const asPoints = (text: string) =>
    text
      .split(/\n+/)
      .map((line) => line.replace(/^\s*[-—•*]\s*/u, "").trim())
      .filter(Boolean);

  const runTool = async (tool: "summary" | "discuss") => {
    setBusy(tool);
    setError(null);
    try {
      const response = await postJson("/api/me/ai", { tool, storyId, question: tool === "discuss" ? question : undefined });
      const data = (await response.json()) as { text?: string; points?: unknown; error?: string };
      if (!response.ok) {
        setError(data.error ?? "تعذر تشغيل الأداة.");
        return;
      }
      if (tool === "summary") {
        if (!Array.isArray(data.points) || data.points.length !== 3 || !data.points.every(point => typeof point === "string" && point.trim())) {
          setError("تعذر إعداد الملخص في ثلاث نقاط واضحة. أعد المحاولة.");
          return;
        }
        setSummary(data.points as string[]);
      } else {
        setAnswer(asPoints(data.text ?? ""));
        setQuestion("");
      }
    } catch {
      setError("تعذر الاتصال بخدمة الذكاء.");
    } finally {
      setBusy(null);
    }
  };

  const toggleSummary = () => {
    const next = !summaryOpen;
    setSummaryOpen(next);
    if (next && !summary && busy !== "summary") void runTool("summary");
  };

  const share = async () => {
    const url = shareUrl;
    try {
      if (navigator.share) await navigator.share({ title, text: title, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* ألغى المشاركة */
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("تعذّر نسخ الرابط في هذا المتصفح.");
    }
  };

  return (
    <div className="sa-tools" aria-label="أدوات القارئ">
      <span className="sa-tools-title">
        <span className="spark" aria-hidden="true">✦</span> أدوات القارئ
      </span>

      <div className="sa-tools-grid">
        <SummaryListen key={`${storyId}:${excerpt}`} storyId={storyId} onStarted={() => {
          if (state.signedIn) void postJson("/api/me/events", { events: [{ type: "listen", storyId }] });
        }} />

        {state.signedIn ? (
          <button
            type="button"
            className={summaryOpen ? "sa-tool is-on" : "sa-tool"}
            aria-pressed={summaryOpen}
            aria-expanded={summaryOpen}
            onClick={toggleSummary}
          >
            <span className="spark" aria-hidden="true">✦</span> لخّص لي
          </button>
        ) : (
          <Link className="sa-tool" href={joinHref}>
            <span className="spark" aria-hidden="true">✦</span> لخّص لي
          </Link>
        )}

        <button type="button" className="sa-tool" onClick={() => void share()}>مشاركة</button>
        <button type="button" className="sa-tool" onClick={() => void copyLink()}>
          {copied ? "نُسخ ✓" : "نسخ الرابط"}
        </button>
      </div>

      {summaryOpen ? (
        <div className="sa-tools-panel">
          <b className="sa-tools-panel-head">
            <span className="spark" aria-hidden="true">✦</span> ملخص في ثلاث نقاط
          </b>
          {busy === "summary" ? (
            <p className="sa-tools-wait">يلخّص المادة…</p>
          ) : summary?.length ? (
            <ol className="sa-summary-points">
              {summary.map((point, index) => <li key={index}>{point}</li>)}
            </ol>
          ) : null}
          <span className="sa-tools-note">مولّد آليًا من نص المادة — راجع النص الكامل قبل الاقتباس.</span>
        </div>
      ) : null}


      {answer?.length ? (
        <div className="sa-tools-panel">
          <b className="sa-tools-panel-head">
            <span className="spark" aria-hidden="true">✦</span> إجابة عن سؤالك
          </b>
          {answer.map((paragraph) => <p key={paragraph.slice(0, 32)}>{paragraph}</p>)}
          <span className="sa-tools-note">إجابة مولّدة آليًا من نص المادة — تحقّق من المصدر قبل الاعتماد.</span>
        </div>
      ) : null}

      {error ? <p className="ai-reader-error" role="alert">{error}</p> : null}

      {state.signedIn ? (
        <form
          className="sa-tools-ask"
          onSubmit={(event) => {
            event.preventDefault();
            if (question.trim().length >= 4) void runTool("discuss");
          }}
        >
          <label className="sr-only" htmlFor={`ask-${storyId}`}>اسأل عن هذه المادة</label>
          <input
            id={`ask-${storyId}`}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={400}
            placeholder="اسأل عن هذه المادة…"
          />
          <button type="submit" disabled={busy === "discuss"}>{busy === "discuss" ? "يجيب…" : "اسأل"}</button>
        </form>
      ) : (
        <Link className="sa-tools-ask is-invite" href={joinHref}>
          <span>اسأل عن هذه المادة…</span>
          <b>انضم</b>
        </Link>
      )}
    </div>
  );
}

export function ArticleTracker({ storyId }: { storyId: string }) {
  const [readerState] = useArticleState(storyId);
  const signedIn = useRef(false);
  const trackedMember = useRef<string | null>(null);
  const activeMs = useRef(0);
  const lastTick = useRef(0);
  const maxProgress = useRef(0);
  const sentMarks = useRef(new Set<number>());
  const opened = useRef(false);

  const isActive = () => document.visibilityState === "visible" && document.hasFocus();

  const progress = () => {
    const root = document.querySelector(".article-body") ?? document.getElementById("main-content");
    if (!root) return 0;
    const rect = root.getBoundingClientRect();
    const total = root.scrollHeight - window.innerHeight;
    if (total <= 0) return rect.bottom < window.innerHeight ? 100 : 0;
    const scrolled = Math.min(total, Math.max(0, -rect.top));
    return Math.round((scrolled / total) * 100);
  };

  const flush = useCallback((finalFlush = false) => {
    if (!signedIn.current) return;
    const now = Date.now();
    if (lastTick.current && isActive()) {
      activeMs.current += Math.min(now - lastTick.current, 5_000);
    }
    lastTick.current = now;
    const duration = activeMs.current;
    const value = maxProgress.current;
    if (duration < 400 && !finalFlush) return;
    activeMs.current = 0;
    void postJson(
      "/api/me/events",
      { events: [{ type: "reading_progress", storyId, durationMs: duration, value }] },
      finalFlush,
    );
  }, [storyId]);

  useEffect(() => {
    signedIn.current = readerState.status === "ready" && readerState.signedIn;
    if (readerState.status === "ready" && trackedMember.current !== readerState.memberId) {
      trackedMember.current = readerState.memberId;
      activeMs.current = 0;
      maxProgress.current = 0;
      sentMarks.current.clear();
      opened.current = false;
    }
    if (signedIn.current && !opened.current) {
      opened.current = true;
      void postJson("/api/me/events", { events: [{ type: "article_open", storyId }] });
    }
  }, [readerState.memberId, readerState.signedIn, readerState.status, storyId]);

  useEffect(() => {
    lastTick.current = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      if (lastTick.current && isActive()) {
        activeMs.current += Math.min(now - lastTick.current, 5_000);
      }
      lastTick.current = now;
      maxProgress.current = Math.max(maxProgress.current, progress());
      for (const mark of [25, 50, 75, 90]) {
        if (signedIn.current && maxProgress.current >= mark && !sentMarks.current.has(mark)) {
          sentMarks.current.add(mark);
          void postJson("/api/me/events", {
            events: [{ type: "reading_progress", storyId, durationMs: activeMs.current, value: maxProgress.current }],
          });
          activeMs.current = 0;
        }
      }
      if (activeMs.current >= FLUSH_MS) flush();
    }, 2_000);

    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
      else lastTick.current = Date.now();
    };
    const onFocus = () => {
      lastTick.current = Date.now();
    };
    const onLeave = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("blur", onLeave);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("focus", onFocus);
      flush(true);
    };
  }, [flush, storyId]);

  return null;
}

export function PersonalizedRelated({
  storyId,
  fallback,
}: {
  storyId: string;
  fallback: RelatedCard[];
}) {
  const [items, setItems] = useState(fallback);

  useEffect(() => {
    fetch(`/api/me/related?storyId=${encodeURIComponent(storyId)}`, { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const next = Array.isArray(data?.items) ? (data.items as RelatedCard[]) : [];
        if (next.length) setItems(next);
      })
      .catch(() => undefined);
  }, [storyId]);

  if (!items.length) return null;

  return (
    <section aria-labelledby="related-title">
      <div className="section-head">
        <h2 id="related-title">نرشّح لك</h2>
        <span className="sub">مواد أخرى قد تهمك</span>
      </div>
      <div className="grid-3">
        {items.map((item) => (
          <article key={item.id} className="m-card">
            {item.image ? (
              <Image className="c-img" src={item.image} alt="" width={640} height={400} />
            ) : null}
            <div className="m-body">
              <div className="m-kick">
                <span>{item.sectionLabel}</span>
              </div>
              <h3>
                <Link
                  href={item.href}
                  onClick={() => {
                    void postJson("/api/me/events", { events: [{ type: "related_click", storyId: item.id }] });
                  }}
                >
                  {item.title}
                </Link>
              </h3>
              {item.reason ? <p className="m-why">{item.reason.text}</p> : null}
              <p>{toLatinDigits(item.readingMinutes)} دقائق قراءة</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
