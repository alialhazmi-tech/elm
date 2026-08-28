"use client";

/**
 * قائمة حلقات البرنامج. التشغيل نفسه في المشغّل العام (شريط ثابت أسفل الصفحة).
 */

import { toLatinDigits } from "@/lib/format";
import { usePodcastDock } from "./podcast-dock";

export interface PlayerEpisode {
  title: string;
  guest: string | null;
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
  const dock = usePodcastDock();

  return (
    <section className="pp-wrap" style={{ "--pp-accent": accent } as React.CSSProperties} aria-label={`حلقات ${showName}`}>
      <div className="pp-head">
        <h2>الحلقات</h2>
        <span className="pp-count latin-number" dir="ltr" lang="en">
          {toLatinDigits(episodes.length)} حلقة
        </span>
      </div>

      <div className="pp-list">
        {episodes.map((episode, index) => {
          const active = dock.track?.audioUrl === episode.audioUrl;
          return (
            <article key={episode.audioUrl} className={`pp-episode${active ? " is-active" : ""}`}>
              <button
                type="button"
                className="pp-play"
                onClick={() =>
                  dock.play({
                    audioUrl: episode.audioUrl,
                    title: episode.title,
                    guest: episode.guest,
                    showName,
                    accent,
                  })
                }
                aria-label={active && dock.playing ? `أوقف ${episode.title}` : `شغّل ${episode.title}`}
              >
                <PlayIcon playing={active && dock.playing} />
              </button>
              <div className="pp-meta">
                <h3 className="pp-ep-title">{episode.title}</h3>
                <dl className="pp-ep-fields">
                  {episode.guest ? (
                    <div>
                      <dt>الضيف</dt>
                      <dd>{episode.guest}</dd>
                    </div>
                  ) : null}
                  {episode.duration ? (
                    <div>
                      <dt>المدة</dt>
                      <dd className="latin-number" dir="ltr" lang="en">{toLatinDigits(episode.duration)}</dd>
                    </div>
                  ) : null}
                  {episode.episode && /^\d+$/.test(episode.episode) ? (
                    <div>
                      <dt>الحلقة</dt>
                      <dd className="latin-number" dir="ltr" lang="en">{toLatinDigits(episode.episode)}</dd>
                    </div>
                  ) : null}
                  {dateLabels[index] ? (
                    <div>
                      <dt>التاريخ</dt>
                      <dd>{dateLabels[index]}</dd>
                    </div>
                  ) : null}
                </dl>
                {episode.description ? <p className="pp-ep-desc">{episode.description}</p> : null}
              </div>
            </article>
          );
        })}
      </div>

      <p className="pp-follow">
        <a href={youtube} rel="noopener noreferrer" target="_blank">تابع {showName} على قناة العلم في يوتيوب ←</a>
      </p>
    </section>
  );
}
