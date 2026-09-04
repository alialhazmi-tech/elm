import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { EpisodePlayButton, EpisodeRow, PodcastHeroPlay } from "@/app/_components/podcast-hero";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { listByFormat } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";
import { brandDate, toLatinDigits } from "@/lib/format";
import { fetchEpisodes, formatPodcastDuration, podcastShowFor, presentEpisode } from "@/lib/podcasts";

/**
 * بودكاست العلم — رابط إرثي حي من الموقع القديم (شرط M-2).
 * هوية خاصة: استوديو داكن، أغلفة كبيرة، وتشغيل مباشر من الصفحة.
 */

export const revalidate = 300;

const ALELM_YOUTUBE = "https://www.youtube.com/c/alelmmedia";

export const metadata: Metadata = {
  title: "بودكاست العلم",
  description: "برامج العلم الصوتية: الغبوق، ملامح، عتمة، وتقرير — استمع مباشرة أو عبر قناة العلم.",
  alternates: { canonical: "/podcasts" },
};

export default async function PodcastsPage() {
  const stories = await listByFormat("podcasts", 24);
  const shows = await Promise.all(
    stories.map(async (story) => {
      const show = podcastShowFor(story.id);
      const episodes = show ? await fetchEpisodes(show).catch(() => []) : [];
      return { story, show, episodes };
    }),
  );

  // أحدث الحلقات عبر كل البرامج — خمس فقط، بترتيب النشر.
  const latest = shows
    .flatMap(({ story, show, episodes }) =>
      show ? episodes.slice(0, 3).map((episode) => ({ story, show, episode })) : [],
    )
    .sort((a, b) => (b.episode.publishedAt ?? "").localeCompare(a.episode.publishedAt ?? ""))
    .slice(0, 5);

  // «شغّل أحدث حلقة» في الاستوديو: أحدث حلقة عبر البرامج كلها.
  const newest = latest[0];
  const newestPresented = newest ? presentEpisode(newest.episode.title, newest.show.name, newest.episode.description) : null;

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader active="/podcasts" />

      <main id="main-content" className="wrap pc-page">
        <section className="pc-studio" aria-label="بودكاست العلم">
          <div className="pc-studio-copy">
            <span className="pc-kicker">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
              </svg>
              بودكاست العلم
            </span>
            <h1>حوارات تُسمع بهدوء</h1>
            <p>أربعة برامج صوتية من العلم — سِيَر وقصص وتقارير، بعيدًا عن ضجيج الخبر العابر. استمع هنا مباشرة أو عبر قناة العلم.</p>
            <div className="pc-hero-actions">
              {newest && newestPresented ? (
                <PodcastHeroPlay
                  showName={newest.show.name}
                  accent={newest.show.accent}
                  episode={{
                    title: newestPresented.title,
                    guest: newestPresented.guest,
                    audioUrl: newest.episode.audioUrl,
                  }}
                />
              ) : null}
              <a className="pc-yt" href={ALELM_YOUTUBE} rel="noopener noreferrer" target="_blank">قناة العلم في يوتيوب ←</a>
            </div>
          </div>
          <div className="pc-covers" aria-hidden="true">
            {shows.slice(0, 4).map(({ story }) =>
              story.image ? (
                <span key={story.id} className="pc-cover-mini">
                  <Image src={story.image} alt="" fill sizes="140px" />
                </span>
              ) : null,
            )}
          </div>
        </section>

        {shows.length > 0 ? (
          <section className="pc-shows" aria-label="البرامج">
            {shows.map(({ story, show, episodes }) => {
              const href = storyHref(story);
              const count = episodes.length;
              return (
                <Link
                  key={story.id}
                  className="pc-show"
                  href={href}
                  style={{ "--pc": show?.accent ?? "#1a4282" } as React.CSSProperties}
                >
                  <span className="pc-show-cover">
                    {story.image ? <Image src={story.image} alt="" fill sizes="(max-width: 640px) 100vw, 280px" /> : null}
                  </span>
                  <span className="pc-show-body">
                    <b>{show?.name ?? story.title}</b>
                    <span className="pc-show-desc">{story.excerpt}</span>
                    <span className="pc-show-meta">
                      {count > 0 ? `${toLatinDigits(count)} حلقة` : "الحلقات على يوتيوب"}
                      <span className="pc-show-cta">استمع ←</span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </section>
        ) : (
          <section className="pc-empty">
            <h2>الحلقات موجودة، وتجربة البرامج الجديدة في الطريق.</h2>
            <a href={ALELM_YOUTUBE} rel="noopener noreferrer" target="_blank">افتح قناة العلم في يوتيوب ←</a>
          </section>
        )}

        {latest.length > 0 ? (
          <section className="pc-latest" aria-label="أحدث الحلقات">
            <div className="section-head">
              <h2>أحدث الحلقات</h2>
              <span className="sub">من كل البرامج</span>
            </div>
            <div className="pp-list">
              {latest.map(({ story, show, episode }) => {
                const presented = presentEpisode(episode.title, show.name, episode.description);
                const duration = formatPodcastDuration(episode.duration);
                return (
                  <EpisodeRow key={episode.audioUrl} audioUrl={episode.audioUrl} accent={show.accent}>
                    <EpisodePlayButton
                      showName={show.name}
                      accent={show.accent}
                      episode={{ title: presented.title, guest: presented.guest, audioUrl: episode.audioUrl }}
                    />
                    <div className="pp-meta">
                      <span className="pp-show-tag"><Link href={storyHref(story)}>{show.name}</Link></span>
                      <h3 className="pp-ep-title">{presented.title}</h3>
                      <dl className="pp-ep-fields">
                        {presented.guest ? <div><dt className="sr-only">الضيف</dt><dd>{presented.guest}</dd></div> : null}
                        {episode.publishedAt ? <div><dt className="sr-only">التاريخ</dt><dd>{brandDate(episode.publishedAt).gregorian}</dd></div> : null}
                      </dl>
                    </div>
                    {duration ? <span className="pp-dur latin-number" dir="ltr" lang="en">{toLatinDigits(duration)}</span> : null}
                  </EpisodeRow>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
