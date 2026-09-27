import Image from "next/image";
import Link from "next/link";

import { EpisodePlayButton, EpisodeRow } from "@/app/_components/podcast-hero";
import { brandDate, toLatinDigits } from "@/lib/format";
import type { PodcastShowEntry } from "@/lib/podcast-catalog";
import { formatPodcastDuration, presentEpisode, type PodcastEpisode, type PodcastShow } from "@/lib/podcasts";
import "@/app/_components/podcast-player.css";

/**
 * بطاقات البرامج بأغلفتها — صفحة /podcasts وقسم الرئيسية.
 * compact للرئيسية: بلا أوصاف ولا «استمع» — سقف حجمها المضغوط 29KiB والنص يتكرر في HTML وبيانات RSC.
 */
export function PodcastShowGrid({ entries, compact = false }: { entries: PodcastShowEntry[]; compact?: boolean }) {
  return (
    <section className="pc-shows" aria-label="البرامج">
      {entries.map(({ show, href, description, episodes, cover }) => (
        <Link key={show.id} className="pc-show" href={href} style={{ "--pc": show.accent } as React.CSSProperties}>
          <span className="pc-show-cover">
            {cover ? <Image src={cover} alt="" fill sizes="(max-width: 640px) 50vw, 280px" unoptimized={cover.startsWith("/podcasts/")} /> : null}
          </span>
          <span className="pc-show-body">
            <b>{show.name}</b>
            {!compact && description ? <span className="pc-show-desc">{description}</span> : null}
            <span className="pc-show-meta">
              {episodes.length > 0 ? `${toLatinDigits(episodes.length)} حلقة` : "الحلقات على يوتيوب"}
              {compact ? null : <span className="pc-show-cta">استمع ←</span>}
            </span>
          </span>
        </Link>
      ))}
    </section>
  );
}

/** صفوف حلقات قابلة للتشغيل في المشغل السفلي دون مغادرة الصفحة؛ compact سطر واحد للضيف والتاريخ. */
export function LatestEpisodeList({ items, compact = false }: { items: Array<{ show: PodcastShow; href: string; episode: PodcastEpisode }>; compact?: boolean }) {
  return (
    <div className="pp-list">
      {items.map(({ show, href, episode }) => {
        const presented = presentEpisode(episode.title, show.name, episode.description, episode.guest);
        const duration = formatPodcastDuration(episode.duration);
        return (
          <EpisodeRow key={episode.audioUrl} audioUrl={episode.audioUrl} accent={show.accent}>
            <EpisodePlayButton
              showName={show.name}
              accent={show.accent}
              episode={{ title: presented.title, guest: presented.guest, audioUrl: episode.audioUrl }}
            />
            <div className="pp-meta">
              <span className="pp-show-tag"><Link href={href}>{show.name}</Link></span>
              <h3 className="pp-ep-title">{presented.title}</h3>
              {compact ? (
                <p className="pp-ep-fields">{[presented.guest, episode.publishedAt ? brandDate(episode.publishedAt).gregorian : null].filter(Boolean).join(" · ")}</p>
              ) : (
                <dl className="pp-ep-fields">
                  {presented.guest ? <div><dt className="sr-only">الضيف</dt><dd>{presented.guest}</dd></div> : null}
                  {episode.publishedAt ? <div><dt className="sr-only">التاريخ</dt><dd>{brandDate(episode.publishedAt).gregorian}</dd></div> : null}
                </dl>
              )}
            </div>
            {duration ? <span className="pp-dur latin-number" dir="ltr" lang="en">{toLatinDigits(duration)}</span> : null}
          </EpisodeRow>
        );
      })}
    </div>
  );
}
