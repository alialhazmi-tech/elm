"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

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
};


const TOOL_ICONS = {
  heart: "M12 20.3l-1.3-1.2C5.9 14.8 3 12.2 3 8.9 3 6.3 5 4.3 7.6 4.3c1.5 0 2.9.7 3.9 1.8 1-1.1 2.4-1.8 3.9-1.8C18 4.3 20 6.3 20 8.9c0 3.3-2.9 5.9-7.7 10.2L12 20.3z",
  listen: "M4 13v-1a8 8 0 0 1 16 0v1M4 13a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2v-3zm16 0a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2v-3z",
  discuss: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V6z",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M8 7l4-4 4 4",
} as const;

function ToolIcon({ name, filled = false }: { name: keyof typeof TOOL_ICONS; filled?: boolean }) {
  return (
    <svg
      className="tool-ico"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TOOL_ICONS[name]} />
    </svg>
  );
}

type State = { signedIn: boolean; liked: boolean };

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

export function ArticleToolbar({
  storyId,
  joinHref,
  excerpt,
}: {
  storyId: string;
  joinHref: string;
  excerpt: string;
}) {
  const [state, setState] = useState<State>({ signedIn: false, liked: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ title: string; text: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [discussOpen, setDiscussOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/me/article-state?storyId=${encodeURIComponent(storyId)}`, { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setState({ signedIn: Boolean(data.signedIn), liked: Boolean(data.liked) });
      })
      .catch(() => undefined);
  }, [storyId]);

  const toggleLike = async () => {
    if (!state.signedIn) return;
    const next = !state.liked;
    setState((current) => ({ ...current, liked: next }));
    try {
      const response = await postJson("/api/me/like", { storyId, liked: next });
      if (!response.ok) throw new Error("like");
      const data = (await response.json()) as { liked?: boolean };
      setState((current) => ({ ...current, liked: Boolean(data.liked) }));
    } catch {
      setState((current) => ({ ...current, liked: !next }));
    }
  };

  const runTool = async (tool: "discuss") => {
    if (!state.signedIn) return;
    setBusy(tool);
    setError(null);
    try {
      const response = await postJson("/api/me/ai", {
        tool,
        storyId,
        question: question,
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok) {
        setError(data.error ?? "تعذر تشغيل الأداة.");
        return;
      }
      setPanel({
        title: "نقاش المادة",
        text: data.text ?? "",
      });
      setDiscussOpen(false);
    } catch {
      setError("تعذر الاتصال بخدمة الذكاء.");
    } finally {
      setBusy(null);
    }
  };

  const listen = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError("الاستماع غير متاح في هذا المتصفح.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(excerpt.slice(0, 1400));
    utterance.lang = "ar-SA";
    utterance.onstart = () => {
      if (state.signedIn) void postJson("/api/me/events", { events: [{ type: "listen", storyId }] });
    };
    window.speechSynthesis.speak(utterance);
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* ألغى المشاركة */
    }
  };

  return (
    <>
      <div className="ai-surface ai-toolbar" aria-label="أدوات القارئ">
        {state.signedIn ? (
          <button
            type="button"
            className={state.liked ? "tool is-on" : "tool"}
            aria-pressed={state.liked}
            onClick={() => void toggleLike()}
          >
            <ToolIcon name="heart" filled={state.liked} />
            أعجبني
          </button>
        ) : (
          <Link className="tool" href={joinHref}>
            <ToolIcon name="heart" />
            أعجبني
          </Link>
        )}
        <button type="button" className="tool" onClick={listen}>
          <ToolIcon name="listen" />
          استمع
        </button>
        {state.signedIn ? (
          <button type="button" className="tool" onClick={() => setDiscussOpen((open) => !open)}>
            <ToolIcon name="discuss" />
            ناقش المادة
          </button>
        ) : (
          <Link className="tool" href={joinHref}>
            <ToolIcon name="discuss" />
            ناقش المادة
          </Link>
        )}
        <button type="button" className="tool" onClick={() => void share()}>
          <ToolIcon name="share" />
          مشاركة
        </button>
      </div>
      {discussOpen ? (
        <form
          className="ai-reader-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void runTool("discuss");
          }}
        >
          <h3>ناقش المادة</h3>
          <label>
            <span className="sr-only">سؤالك عن المادة</span>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={400}
              placeholder="اسأل عن فكرة وردت في المادة"
            />
          </label>
          <button type="submit" className="tool primary" disabled={busy === "discuss"}>
            {busy === "discuss" ? "يجيب…" : "اسأل"}
          </button>
        </form>
      ) : null}
      {error ? <p className="ai-reader-error" role="alert">{error}</p> : null}
      {panel ? (
        <div className="ai-reader-panel">
          <h3>{panel.title}</h3>
          {panel.text.split(/\n+/).map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function ArticleTracker({ storyId }: { storyId: string }) {
  const signedIn = useRef(false);
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
    fetch(`/api/me/article-state?storyId=${encodeURIComponent(storyId)}`, { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        signedIn.current = Boolean(data?.signedIn);
        if (signedIn.current && !opened.current) {
          opened.current = true;
          void postJson("/api/me/events", { events: [{ type: "article_open", storyId }] });
        }
      })
      .catch(() => undefined);

    lastTick.current = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      if (lastTick.current && isActive()) {
        activeMs.current += Math.min(now - lastTick.current, 5_000);
      }
      lastTick.current = now;
      maxProgress.current = Math.max(maxProgress.current, progress());
      for (const mark of [25, 50, 75, 90]) {
        if (maxProgress.current >= mark && !sentMarks.current.has(mark)) {
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
        <div>
          <h2 id="related-title">مواد ذات صلة</h2>
        </div>
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
              <p>{toLatinDigits(item.readingMinutes)} دقائق قراءة</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
