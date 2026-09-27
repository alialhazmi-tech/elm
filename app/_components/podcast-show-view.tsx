import Image from "next/image";
import Link from "next/link";

import { PodcastHeroPlay } from "@/app/_components/podcast-hero";
import { PodcastPlayer } from "@/app/_components/podcast-player";
import { brandDate, toLatinDigits } from "@/lib/format";
import { formatPodcastDuration, presentEpisode, type PodcastEpisode, type PodcastShow } from "@/lib/podcasts";

/**
 * صفحة برنامج بودكاست: الترويسة بالغلاف والتشغيل ثم قائمة الحلقات.
 * تشترك فيها مادة البرنامج القديمة (/القسم/المعرّف/السلاج) وصفحة /podcasts/<id>.
 */
export function PodcastShowView({
  show,
  cover,
  description,
  since,
  episodes,
}: {
  show: PodcastShow;
  cover: string | null | undefined;
  description: string | null | undefined;
  /** تاريخ بداية البرنامج في الترويسة — تاريخ مادته القديمة إن وُجد. */
  since?: string | null;
  episodes: PodcastEpisode[];
}) {
  const latest = episodes[0]
    ? (() => {
        const presented = presentEpisode(episodes[0].title, show.name, episodes[0].description, episodes[0].guest);
        return { title: presented.title, guest: presented.guest, audioUrl: episodes[0].audioUrl };
      })()
    : null;
  // الأغلفة الثابتة في /public تُخدم كما هي؛ المرفوعة من اللوحة تمر بالمحسّن.
  const unoptimized = Boolean(cover?.startsWith("/podcasts/"));

  return (
    <>
      <header className="pc-hero podcast-show" style={{ "--pc": show.accent } as React.CSSProperties}>
        <div className="pc-hero-cover">
          {cover ? <Image src={cover} alt="" fill sizes="(max-width: 640px) 160px, 260px" unoptimized={unoptimized} priority /> : null}
        </div>
        <div className="pc-hero-copy">
          <span className="pc-kicker">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
            </svg>
            <Link href="/podcasts">بودكاست العلم</Link>
          </span>
          <h1>{show.name}</h1>
          {description ? <p className="pc-hero-desc">{description}</p> : null}
          <p className="pc-hero-meta">
            {episodes.length > 0 ? `${toLatinDigits(episodes.length)} حلقة` : "الحلقات على يوتيوب"}
            {since ? (
              <>
                <span aria-hidden="true"> · </span>
                منذ <time dateTime={since}>{brandDate(since).gregorian}</time>
              </>
            ) : null}
          </p>
          <div className="pc-hero-actions">
            <PodcastHeroPlay showName={show.name} accent={show.accent} episode={latest} />
            <a className="pc-yt" href={show.youtube} rel="noopener noreferrer" target="_blank">يوتيوب ←</a>
          </div>
        </div>
      </header>

      {episodes.length > 0 ? (
        <PodcastPlayer
          showName={show.name}
          accent={show.accent}
          youtube={show.youtube}
          episodes={episodes.map((episode) => {
            const presented = presentEpisode(episode.title, show.name, episode.description, episode.guest);
            return {
              title: presented.title,
              guest: presented.guest,
              audioUrl: episode.audioUrl,
              publishedAt: episode.publishedAt,
              duration: formatPodcastDuration(episode.duration),
              description: episode.description,
              episode: episode.episode,
            };
          })}
          dateLabels={episodes.map((episode) => (episode.publishedAt ? brandDate(episode.publishedAt).gregorian : ""))}
        />
      ) : (
        <section className="ai-surface" style={{ marginTop: 26 }} aria-label="حلقات البرنامج">
          <p style={{ margin: 0, lineHeight: 1.9 }}>
            حلقات {show.name} تُبث عبر{" "}
            <a href={show.youtube} rel="noopener noreferrer" target="_blank">
              قناة العلم في يوتيوب ←
            </a>
          </p>
        </section>
      )}
    </>
  );
}
