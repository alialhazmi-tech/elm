"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Pause, Play } from "lucide-react";

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
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const isHome = className === "brief-listen";
  const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
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
    <div className={`summary-listen${isHome ? " summary-listen-home" : ""}${ready ? " is-ready" : ""}`}>
      <button type="button" className={`${className}${playing ? " is-on" : ""}`} aria-pressed={playing}
        aria-label={loading ? "إلغاء تجهيز الصوت" : playing ? "إيقاف الاستماع مؤقتًا" : "استمع للموجز"}
        onClick={() => void toggle()}>
        <span className="summary-play-icon">{loading ? <LoaderCircle aria-hidden="true" size={17} /> : playing ? <Pause aria-hidden="true" size={17} fill="currentColor" /> : <Play aria-hidden="true" size={17} fill="currentColor" />}</span>
        <span className={isHome && ready ? "sr-only" : undefined}>{loading ? "جارٍ تجهيز الصوت…" : playing ? "إيقاف مؤقت" : error ? "إعادة المحاولة" : "استمع للموجز"}</span>
      </button>
      <div className="summary-listen-player" hidden={!ready}>
        {/* النص البديل هو الموجز نفسه المعروض بجوار الزر، دون محتوى صوتي إضافي. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={audio} hidden preload="none" aria-label="مشغل الموجز الصوتي"
        onDurationChange={(event) => { const value = event.currentTarget.duration; setDuration(Number.isFinite(value) && value > 0 ? value : 0); }}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onPlay={() => { setPlaying(true); onStarted?.(); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onError={() => { setPlaying(false); setError("تعذر تشغيل الصوت. حاول مرة أخرى.");
          if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; setReady(false); setDuration(0); setPosition(0); }} />
        <div className="summary-listen-timeline">
          <div className="summary-listen-times"><span>الموجز الصوتي</span><span dir="ltr">{time(position)} <span aria-hidden="true">/</span> {duration ? time(duration) : "—:—"}</span></div>
          <input type="range" min={0} max={duration || 1} step={0.1} value={Math.min(position, duration || 0)} disabled={!duration}
            dir="ltr" aria-label="موضع الاستماع" aria-valuetext={`${time(position)} من ${time(duration)}`}
            style={{ backgroundImage: `linear-gradient(to right, var(--navy) ${duration ? position / duration * 100 : 0}%, var(--line) 0%)` }}
            onChange={(event) => { if (audio.current && duration) { const value = Number(event.target.value); audio.current.currentTime = value; setPosition(value); } }} />
        </div>
        <p className="summary-listen-credit">تم توليد الصوت عبر <bdi lang="en">HUMAIN</bdi></p>
      </div>
      {loading ? <span role="status" className="summary-listen-note">يُجهّز الصوت عند أول استماع، ثم يُحفظ للاستماع التالي.</span> : null}
      {error ? <span role="status" className="summary-listen-note">{error}</span> : null}
    </div>
  );
}
