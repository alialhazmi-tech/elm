import type { Metadata } from "next";
import { sharingMetadata } from "@/lib/sharing";
import Image from "next/image";

import { LatestEpisodeList, PodcastShowGrid } from "@/app/_components/podcast-overview";
import { PodcastHeroPlay } from "@/app/_components/podcast-hero";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { latestEpisodes, listPodcastShows, podcastOverview } from "@/lib/podcast-catalog";
import { presentEpisode } from "@/lib/podcasts";

/**
 * بودكاست العلم — رابط إرثي حي من الموقع القديم (شرط M-2).
 * هوية خاصة: استوديو داكن، أغلفة كبيرة، وتشغيل مباشر من الصفحة.
 */

export const revalidate = 300;

const ALELM_YOUTUBE = "https://www.youtube.com/c/alelmmedia";

/** «الغبوق، ملامح، عتمة، وتقرير» — أسماء البرامج الظاهرة بترتيبها في اللوحة. */
function joinNames(names: string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join("، ")}، و${names[names.length - 1]}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const names = (await listPodcastShows()).map((show) => show.name);
  const description = `برامج العلم الصوتية: ${joinNames(names)} — استمع مباشرة أو عبر قناة العلم.`;
  return {
    title: "بودكاست العلم",
    description,
    alternates: { canonical: "/podcasts" },
    ...sharingMetadata({ title: "بودكاست العلم", description, path: "/podcasts" }),
  };
}

export default async function PodcastsPage() {
  const shows = await podcastOverview();
  // أحدث الحلقات عبر كل البرامج — خمس فقط، بترتيب النشر.
  const latest = latestEpisodes(shows, 5);

  // «شغّل أحدث حلقة» في الاستوديو: أحدث حلقة عبر البرامج كلها.
  const newest = latest[0];
  const newestPresented = newest ? presentEpisode(newest.episode.title, newest.show.name, newest.episode.description, newest.episode.guest) : null;

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
            <p>برامج صوتية من العلم — سِيَر وقصص وتقارير، بعيدًا عن ضجيج الخبر العابر. استمع هنا مباشرة أو عبر قناة العلم.</p>
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
            {shows.slice(0, 4).map(({ show, cover }) =>
              cover ? (
                <span key={show.id} className="pc-cover-mini">
                  <Image src={cover} alt="" fill sizes="140px" unoptimized={cover.startsWith("/podcasts/")} />
                </span>
              ) : null,
            )}
          </div>
        </section>

        {shows.length > 0 ? (
          <PodcastShowGrid entries={shows} />
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
            <LatestEpisodeList items={latest} />
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
