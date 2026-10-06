import type { MetadataRoute } from "next";

import { ALL_SERIES } from "@/lib/content/series";
import { SECTIONS } from "@/lib/content/sections";
import { listSitemapEntries } from "@/lib/content/provider";
import { publicStoryId } from "@/lib/content/canonical-stories";
import { listPodcastShows } from "@/lib/podcast-catalog";
import { podcastShowPath } from "@/lib/podcasts";
import { listJakReports } from "@/lib/tahrir/jak-reports";
import { jakReportHref } from "@/lib/jak-urls";

/**
 * خريطة الموقع الشاملة: الصفحات الثابتة والأقسام والسلاسل وكل المواد المنشورة (stories).
 * شرط الهجرة: كل مادة من أرشيف ووردبريس الـ29 ألفًا تظهر هنا برابطها المحفوظ حرفيًا.
 * السقف القياسي 50 ألف رابط للخريطة الواحدة — عند الاقتراب منه تُقسَّم إلى فهرس.
 */

export const revalidate = 3600;

const BASE_URL = "https://alelm.net";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Omit lastmod when there is no real content modification timestamp.
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL },
    { url: `${BASE_URL}/series` },
    { url: `${BASE_URL}/podcasts` },
    { url: `${BASE_URL}/jak` },
    { url: `${BASE_URL}/about` },
    { url: `${BASE_URL}/ai` },
    { url: `${BASE_URL}/contact` },
    { url: `${BASE_URL}/privacy-policy` },
  ];

  const sectionPages: MetadataRoute.Sitemap = SECTIONS.map((sec) => ({
    url: `${BASE_URL}/${sec.slug}`,
  }));

  const seriesPages: MetadataRoute.Sitemap = ALL_SERIES.map((s) => ({
    url: `${BASE_URL}/series/${s.slug}`,
  }));

  // برامج البودكاست التي لا مادة لها — البرامج القديمة تظهر بروابط موادها أدناه.
  const podcastPages: MetadataRoute.Sitemap = (await listPodcastShows())
    .filter((show) => !show.storyId)
    .map((show) => ({ url: `${BASE_URL}${podcastShowPath(show)}` }));

  // كل المواد المنشورة — storyHref المقدس /{section}/{id}/{slug} بترميز URL قياسي.
  const stories = await listSitemapEntries();
  const storyPages: MetadataRoute.Sitemap = stories.map((story) => ({
    url: `${BASE_URL}/${story.section}/${publicStoryId(story)}/${encodeURIComponent(story.slug)}`,
    lastModified: story.updatedAt ?? story.publishedAt ?? undefined,
  }));

  const jakPages: MetadataRoute.Sitemap = (await listJakReports({ publicOnly: true, limit: 100 }))
    .map((report) => ({ url: `${BASE_URL}${jakReportHref(report)}`, lastModified: report.updatedAt }));
  return [...staticPages, ...sectionPages, ...seriesPages, ...podcastPages, ...storyPages, ...jakPages];
}
