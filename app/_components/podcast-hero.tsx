"use client";

/**
 * زر «شغّل أحدث حلقة» في رأس البرنامج — يشغّل عبر المشغّل العام الثابت.
 */

import { usePodcastDock } from "./podcast-dock";

export function PodcastHeroPlay({
  showName,
  accent,
  episode,
}: {
  showName: string;
  accent: string;
  episode: { title: string; guest: string | null; audioUrl: string } | null;
}) {
  const dock = usePodcastDock();
  if (!episode) return null;
  const active = dock.track?.audioUrl === episode.audioUrl;
  const playing = active && dock.playing;
  return (
    <button
      type="button"
      className="pc-play"
      onClick={() => dock.play({ audioUrl: episode.audioUrl, title: episode.title, guest: episode.guest, showName, accent })}
      aria-label={playing ? "أوقف الحلقة" : "شغّل أحدث حلقة"}
    >
      <span className="pc-play-ico" aria-hidden="true">
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" /></svg>
        )}
      </span>
      <span className="pc-play-txt">
        <b>{playing ? "يُشغَّل الآن" : "شغّل أحدث حلقة"}</b>
        <small>{episode.title}</small>
      </span>
    </button>
  );
}

/**
 * صف حلقة في «أحدث الحلقات» — يصطبغ بلون البرنامج أثناء التشغيل.
 * المحتوى يُبنى خادميًا ويُمرَّر كأبناء؛ العميل يحمل حالة التشغيل وحدها.
 */
export function EpisodeRow({
  audioUrl,
  accent,
  children,
}: {
  audioUrl: string;
  accent: string;
  children: React.ReactNode;
}) {
  const dock = usePodcastDock();
  const active = dock.track?.audioUrl === audioUrl;
  return (
    <article
      className={active ? "pp-episode is-active" : "pp-episode"}
      style={{ "--pp-accent": accent } as React.CSSProperties}
    >
      {children}
    </article>
  );
}

/** زر تشغيل دائري صغير — لقائمة أحدث الحلقات عبر البرامج. */
export function EpisodePlayButton({
  showName,
  accent,
  episode,
}: {
  showName: string;
  accent: string;
  episode: { title: string; guest: string | null; audioUrl: string };
}) {
  const dock = usePodcastDock();
  const playing = dock.track?.audioUrl === episode.audioUrl && dock.playing;
  return (
    <button
      type="button"
      className="pp-play"
      style={{ "--pp-accent": accent } as React.CSSProperties}
      onClick={() => dock.play({ audioUrl: episode.audioUrl, title: episode.title, guest: episode.guest, showName, accent })}
      aria-label={playing ? `أوقف ${episode.title}` : `شغّل ${episode.title}`}
    >
      {playing ? (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" /></svg>
      )}
    </button>
  );
}
