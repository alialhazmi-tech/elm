"use client";

/**
 * مشغل بودكاست «الطبعة التحريرية» — مبني يدويًا بلا مكتبات:
 * عنصر صوت واحد مشترك، بطاقات حلقات، وشريط تشغيل لاصق بشريط تقدم
 * وسرعة قراءة وقفز ±15 ثانية. الصوت يتدفق من خلاصة RSS المصدرية مباشرة.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { toLatinDigits } from "@/lib/format";

export interface PlayerEpisode {
  title: string;
  audioUrl: string;
  publishedAt: string | null;
  duration: string | null;
  description: string;
  episode: string | null;
}

interface Props {
  showName: string;
  accent: string;
  episodes: PlayerEpisode[];
  youtube: string;
  dateLabels: string[];
}

const RATES = [1, 1.25, 1.5, 2];

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
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

export function PodcastPlayer({ showName, accent, episodes, youtube, dateLabels }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState<number | null>(null);

  const select = useCallback(
    (index: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (current === index) {
        if (audio.paused) void audio.play().catch(() => setFailed(index));
        else audio.pause();
        return;
      }
      setFailed(null);
      setCurrent(index);
      setProgress(0);
      setDuration(0);
      audio.src = episodes[index].audioUrl;
      audio.playbackRate = rate;
      void audio.play().catch(() => setFailed(index));
    },
    [current, episodes, rate],
  );

  const skip = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (audio?.duration) audio.currentTime = Math.min(Math.max(0, audio.currentTime + delta), audio.duration);
  }, []);

  const cycleRate = useCallback(() => {
    setRate((prev) => {
      const next = RATES[(RATES.indexOf(prev) + 1) % RATES.length];
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);

  useEffect(() => () => audioRef.current?.pause(), []);

  const active = current !== null ? episodes[current] : null;

  return (
    <section className="pp-wrap" style={{ "--pp-accent": accent } as React.CSSProperties} aria-label={`حلقات ${showName}`}>
      <div className="pp-head">
        <h2>حلقات {showName}</h2>
        <span className="pp-count latin-number" dir="ltr" lang="en">
          {toLatinDigits(episodes.length)} حلقة
        </span>
      </div>

      <div className="pp-list">
        {episodes.map((episode, index) => (
          <article key={episode.audioUrl} className={`pp-episode${current === index ? " is-active" : ""}`}>
            <button
              type="button"
              className="pp-play"
              onClick={() => select(index)}
              aria-label={current === index && playing ? `أوقف ${episode.title}` : `شغّل ${episode.title}`}
            >
              <PlayIcon playing={current === index && playing} />
            </button>
            <div className="pp-meta">
              <h3 className="pp-ep-title">{episode.title}</h3>
              <p className="pp-ep-sub">
                {episode.episode ? <span>الحلقة {toLatinDigits(episode.episode)}</span> : null}
                {dateLabels[index] ? <span>{dateLabels[index]}</span> : null}
                {episode.duration ? (
                  <span className="latin-number" dir="ltr" lang="en">{toLatinDigits(episode.duration)}</span>
                ) : null}
              </p>
              {episode.description ? <p className="pp-ep-desc">{episode.description}</p> : null}
              {failed === index ? (
                <p className="pp-ep-error">
                  تعذر بث الحلقة الآن — <a href={youtube} rel="noopener noreferrer" target="_blank">استمع عبر قناة العلم</a>
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {active ? (
        <div className="pp-bar" role="region" aria-label="مشغل الحلقة الحالية">
          <button
            type="button"
            className="pp-play"
            onClick={() => select(current!)}
            aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
          >
            <PlayIcon playing={playing} />
          </button>
          <div className="pp-bar-mid">
            <p className="pp-bar-title">{active.title}</p>
            <div className="pp-bar-row" dir="ltr">
              <span className="pp-time latin-number" lang="en">{clock(progress)}</span>
              <input
                className="pp-seek"
                type="range"
                min={0}
                max={duration || 0}
                step={1}
                value={Math.min(progress, duration || 0)}
                onChange={(event) => {
                  const audio = audioRef.current;
                  if (audio) audio.currentTime = Number(event.target.value);
                }}
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
        </div>
      ) : null}

      <p className="pp-follow">
        <a href={youtube} rel="noopener noreferrer" target="_blank">تابع {showName} على قناة العلم في يوتيوب ←</a>
      </p>

      {/* عنصر الصوت الواحد المشترك — لا واجهة له؛ الواجهة أعلاه */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
        onError={() => current !== null && setFailed(current)}
      />
    </section>
  );
}
