import { notFound } from "next/navigation";

import { ShowClient } from "@/components/tahrir/podcasts/show-client";
import { fetchRssEpisodes, toAdminEpisode, toAdminShow, toFeedEpisode } from "@/lib/tahrir/podcast-screens";
import { getShowAdmin, listShowsAdmin } from "@/lib/tahrir/podcasts";
import { requireScreen } from "@/lib/tahrir/screen";

export const metadata = { title: "حلقات البرنامج" };
export const dynamic = "force-dynamic";

export default async function PodcastShowAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requireScreen("podcasts.manage", "البودكاست");
  if (!gate.ok) return gate.element;
  const { id } = await params;
  const [detail, all] = await Promise.all([getShowAdmin(id), listShowsAdmin()]);
  const summary = all.find((show) => show.id === id);
  if (!detail || !summary) notFound();
  const feed = await fetchRssEpisodes(detail.show.feedUrl);
  return (
    <ShowClient
      show={await toAdminShow(summary, feed)}
      shows={all.map((show) => ({ id: show.id, name: show.name, accent: show.accent }))}
      episodes={detail.episodes.map(toAdminEpisode)}
      feed={feed.map((episode) => toFeedEpisode(episode, detail.show.name))}
    />
  );
}
