import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { PodcastShowView } from "@/app/_components/podcast-show-view";
import { PublicBreadcrumbs } from "@/app/_components/public-breadcrumbs";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { seedContentProvider } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";
import { getPodcastShow, showEpisodes } from "@/lib/podcast-catalog";
import { PODCAST_SHOW_ID } from "@/lib/podcast-input";
import { podcastShowPath } from "@/lib/podcasts";
import { sharingMetadata } from "@/lib/sharing";
import "@/app/_components/podcast-player.css";

/**
 * صفحة برنامج بودكاست أُنشئ من اللوحة (/podcasts/<id>).
 * البرامج القديمة صفحتها مادتها فتتحول إليها، والأرقام روابط مواد قديمة (/podcasts/<رقم>)
 * كانت يحسمها مسار /[section]/[id] قبل وجود هذه الصفحة فتبقى تتحول إلى المادة.
 */

export const revalidate = 300;
export const dynamicParams = true;

type Params = { params: Promise<{ slug: string }> };

async function resolve(slug: string) {
  const decoded = (() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();
  if (!PODCAST_SHOW_ID.test(decoded)) {
    const story = /^[A-Za-z0-9_-]{1,64}$/u.test(decoded) ? await seedContentProvider.getStory(decoded) : null;
    if (story) permanentRedirect(encodeURI(storyHref(story)));
    notFound();
  }
  const show = await getPodcastShow(decoded);
  if (!show) notFound();
  if (show.storyId) {
    const story = await seedContentProvider.getStory(show.storyId);
    if (story) permanentRedirect(encodeURI(storyHref(story)));
  }
  return show;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const show = await getPodcastShow(slug).catch(() => undefined);
  if (!show) return { title: "البرنامج غير متاح", robots: { index: false, follow: true } };
  const title = `${show.name} — بودكاست العلم`;
  const description = show.description || `حلقات برنامج ${show.name} من بودكاست العلم.`;
  const path = podcastShowPath(show);
  return {
    title,
    description,
    alternates: { canonical: path },
    ...sharingMetadata({ title, description, path, image: show.cover }),
  };
}

export default async function PodcastShowPage({ params }: Params) {
  const { slug } = await params;
  const show = await resolve(slug);
  const episodes = await showEpisodes(show);

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader active="/podcasts" />
      <main id="main-content" className="article-shell">
        <PublicBreadcrumbs items={[{ label: "الرئيسية", href: "/" }, { label: "بودكاست العلم", href: "/podcasts" }, { label: show.name }]} />
        <article>
          <PodcastShowView show={show} cover={show.cover} description={show.description} episodes={episodes} />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
