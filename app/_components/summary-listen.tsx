"use client";

import { useEffect, useRef, useState } from "react";

export function SummaryListen({ storyId, className = "sa-tool", onStarted }: {
  storyId?: string; className?: string; onStarted?: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const controller = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);
  const operation = useRef(0);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => {
    operation.current++;
    controller.current?.abort();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  const toggle = async () => {
    const player = audio.current;
    if (!player) return;
    if (loading) { operation.current++; controller.current?.abort(); setLoading(false); return; }
    if (!player.paused) { player.pause(); return; }
    setError(null);
    const current = ++operation.current;
    try {
      if (!objectUrl.current) {
        setLoading(true);
        controller.current = new AbortController();
        const response = await fetch("/api/content/listen", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(storyId ? { kind: "story", storyId } : { kind: "home" }),
          signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(115000)]) });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(typeof result.error === "string" ? result.error : "تعذر تجهيز الصوت الآن.");
        }
        if (!response.headers.get("content-type")?.startsWith("audio/wav")) throw new Error("تعذر تحميل الصوت.");
        const blob = await response.blob();
        if (current !== operation.current) return;
        objectUrl.current = URL.createObjectURL(blob);
        player.src = objectUrl.current;
        setReady(true);
      }
      if (current !== operation.current) return;
      setLoading(false);
      await player.play();
    } catch (failure) {
      if (current !== operation.current) return;
      setLoading(false);
      setPlaying(false);
      setError(failure instanceof DOMException ? "اضغط تشغيل للاستماع، أو حاول مرة أخرى." : failure instanceof Error ? failure.message : "تعذر تشغيل الصوت.");
    }
  };
  return (
    <div className="summary-listen">
      <button type="button" className={`${className}${playing ? " is-on" : ""}`} aria-pressed={playing}
        aria-label={loading ? "إلغاء تجهيز الصوت" : playing ? "إيقاف الاستماع مؤقتًا" : "استمع للموجز"}
        onClick={() => void toggle()}>
        <span aria-hidden="true">{loading ? "◌" : playing ? "⏸" : "▶"}</span>{" "}
        {loading ? "جارٍ تجهيز الصوت…" : playing ? "إيقاف مؤقت" : error ? "إعادة المحاولة" : "استمع للموجز"}
      </button>
      {/* النص البديل هو الموجز نفسه المعروض بجوار الزر، دون محتوى صوتي إضافي. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audio} controls={ready} hidden={!ready} preload="none" aria-label="مشغل الموجز الصوتي"
        onPlay={() => { setPlaying(true); onStarted?.(); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onError={() => { setPlaying(false); setError("تعذر تشغيل الصوت. حاول مرة أخرى.");
          if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; setReady(false); }} />
      {loading ? <span role="status" className="summary-listen-note">يُجهّز الصوت عند أول استماع، ثم يُحفظ للاستماع التالي.</span> : null}
      {error ? <span role="status" className="summary-listen-note">{error}</span> : null}
    </div>
  );
}
