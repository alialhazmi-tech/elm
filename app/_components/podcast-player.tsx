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

function FieldIcon({ name }: { name: "guest" | "duration" | "episode" | "date" }) {
  const paths = {
    guest: "M12 12a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 12Zm0 1.8c-3.1 0-7 1.5-7 4.2V20h14v-2c0-2.7-3.9-4.2-7-4.2Z",
    duration: "M12 4.5a7.5 7.5 0 1 0 7.5 7.5A7.5 7.5 0 0 0 12 4.5Zm.7 4v3.2l2.6 1.6-.7 1.1L11 12.4V8.5Z",
    episode: "M8 6h10v2H8Zm0 5h10v2H8Zm0 5h7v2H8ZM5 6.2h1.6v1.6H5Zm0 5h1.6v1.6H5Zm0 5h1.6v1.6H5Z",
    date: "M7 4.5h1.6V6h6.8V4.5H17V6h2v14H5V6h2Zm10.4 4.2H6.6v9.6h10.8Z",
  } as const;
  return (
    <svg className="pp-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
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
                      <dt className="sr-only">الضيف</dt>
                      <dd><FieldIcon name="guest" />{episode.guest}</dd>
                    </div>
                  ) : null}
                  {episode.duration ? (
                    <div>
                      <dt className="sr-only">المدة</dt>
                      <dd className="latin-number" dir="ltr" lang="en">
                        <FieldIcon name="duration" />{toLatinDigits(episode.duration)}
                      </dd>
                    </div>
                  ) : null}
                  {episode.episode && /^\d+$/.test(episode.episode) ? (
                    <div>
                      <dt className="sr-only">الحلقة</dt>
                      <dd className="latin-number" dir="ltr" lang="en">
                        <FieldIcon name="episode" />{toLatinDigits(episode.episode)}
                      </dd>
                    </div>
                  ) : null}
                  {dateLabels[index] ? (
                    <div>
                      <dt className="sr-only">التاريخ</dt>
                      <dd><FieldIcon name="date" />{dateLabels[index]}</dd>
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
