"use client";

/**
 * مشغّل عام يعيش في التخطيط الجذر — يستمر الصوت والشريط عند التنقّل.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import "@/app/_components/podcast-dock.css";

export type DockTrack = {
  audioUrl: string;
  title: string;
  guest: string | null;
  showName: string;
  accent: string;
};

type DockApi = {
  track: DockTrack | null;
  playing: boolean;
  progress: number;
  duration: number;
  rate: number;
  play: (track: DockTrack) => void;
  toggle: () => void;
  skip: (delta: number) => void;
  seek: (seconds: number) => void;
  cycleRate: () => void;
  stop: () => void;
};

const RATES = [1, 1.25, 1.5, 2];
const DockContext = createContext<DockApi | null>(null);

export function usePodcastDock(): DockApi {
  const value = useContext(DockContext);
  if (!value) throw new Error("PodcastDockProvider مفقود");
  return value;
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.2" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

export function PodcastDockProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [track, setTrack] = useState<DockTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);

  const play = useCallback((next: DockTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (track?.audioUrl === next.audioUrl) {
      if (audio.paused) void audio.play();
      else audio.pause();
      return;
    }
    setTrack(next);
    setProgress(0);
    setDuration(0);
    audio.src = next.audioUrl;
    audio.playbackRate = rate;
    void audio.play();
  }, [rate, track?.audioUrl]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }, [track]);

  const skip = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (audio?.duration) audio.currentTime = Math.min(Math.max(0, audio.currentTime + delta), audio.duration);
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = seconds;
  }, []);

  const cycleRate = useCallback(() => {
    setRate((prev) => {
      const next = RATES[(RATES.indexOf(prev) + 1) % RATES.length];
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    audio?.pause();
    if (audio) audio.removeAttribute("src");
    setTrack(null);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-pp-dock", Boolean(track));
    return () => document.documentElement.removeAttribute("data-pp-dock");
  }, [track]);

  const api = useMemo<DockApi>(
    () => ({ track, playing, progress, duration, rate, play, toggle, skip, seek, cycleRate, stop }),
    [track, playing, progress, duration, rate, play, toggle, skip, seek, cycleRate, stop],
  );

  return (
    <DockContext.Provider value={api}>
      {children}
      {track ? (
        <div
          className="pp-bar"
          role="region"
          aria-label="مشغل الحلقة الحالية"
          style={{ "--pp-accent": track.accent } as React.CSSProperties}
        >
          <button type="button" className="pp-play" onClick={toggle} aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}>
            <PlayIcon playing={playing} />
          </button>
          <div className="pp-bar-mid">
            <p className="pp-bar-title">{track.title}</p>
            <p className="pp-bar-sub">
              {track.guest ? <span>ضيف: {track.guest}</span> : null}
              <span>{track.showName}</span>
            </p>
            <div className="pp-bar-row" dir="ltr">
              <span className="pp-time latin-number" lang="en">{clock(progress)}</span>
              <input
                className="pp-seek"
                type="range"
                min={0}
                max={duration || 0}
                step={1}
                value={Math.min(progress, duration || 0)}
                onChange={(event) => seek(Number(event.target.value))}
                aria-label="موضع التشغيل"
              />
              <span className="pp-time latin-number" lang="en">{clock(duration)}</span>
            </div>
          </div>
          <div className="pp-tools">
            <button type="button" className="pp-tool" onClick={() => skip(-15)} aria-label="ارجع 15 ثانية">
              <span className="latin-number" dir="ltr" lang="en">15-</span>
            </button>
            <button type="button" className="pp-tool" onClick={() => skip(15)} aria-label="تقدم 15 ثانية">
              <span className="latin-number" dir="ltr" lang="en">15+</span>
            </button>
            <button type="button" className="pp-tool latin-number" dir="ltr" lang="en" onClick={cycleRate} aria-label="سرعة التشغيل">
              {rate}×
            </button>
          </div>
          <button type="button" className="pp-close" onClick={stop} aria-label="أغلق المشغل">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      ) : null}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
    </DockContext.Provider>
  );
}
