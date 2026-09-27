import { PodcastsClient } from "@/components/tahrir/podcasts/podcasts-client";
import { fetchRssEpisodes, toAdminShow } from "@/lib/tahrir/podcast-screens";
import { listShowsAdmin } from "@/lib/tahrir/podcasts";
import { requireScreen } from "@/lib/tahrir/screen";

export const metadata = { title: "البودكاست" };
export const dynamic = "force-dynamic";

export default async function PodcastsAdminPage() {
  const gate = await requireScreen("podcasts.manage", "البودكاست");
  if (!gate.ok) return gate.element;
  const rows = await listShowsAdmin();
  // عدد حلقات الخلاصة من كاش RSS نفسه الذي يقرأ منه الموقع (عشر دقائق).
  const shows = await Promise.all(rows.map(async (show) => toAdminShow(show, await fetchRssEpisodes(show.feedUrl))));
  return <PodcastsClient shows={shows} />;
}
