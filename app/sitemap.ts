import type { MetadataRoute } from "next";

import { ALL_SERIES } from "@/lib/content/series";
import { SECTIONS } from "@/lib/content/sections";
import { listSitemapEntries } from "@/lib/content/provider";

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
    { url: BASE_URL, changeFrequency: "hourly", priority: 1.0 },
    { url: `${BASE_URL}/series`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/podcasts`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/about`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/contact`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/privacy-policy`, changeFrequency: "yearly", priority: 0.4 },
  ];

  const sectionPages: MetadataRoute.Sitemap = SECTIONS.map((sec) => ({
    url: `${BASE_URL}/${sec.slug}`,
    changeFrequency: "daily",
    priority: sec.navPriority === 1 ? 0.9 : 0.8,
  }));

  const seriesPages: MetadataRoute.Sitemap = ALL_SERIES.map((s) => ({
    url: `${BASE_URL}/series/${s.slug}`,
    changeFrequency: "weekly",
    priority: s.archived ? 0.6 : 0.85,
  }));

  // كل المواد المنشورة — storyHref المقدس /{section}/{id}/{slug} بترميز URL قياسي.
  const stories = await listSitemapEntries();
  const storyPages: MetadataRoute.Sitemap = stories.map((story) => ({
    url: `${BASE_URL}/${story.section}/${story.id}/${encodeURIComponent(story.slug)}`,
    lastModified: story.updatedAt ?? story.publishedAt ?? undefined,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...sectionPages, ...seriesPages, ...storyPages];
}
