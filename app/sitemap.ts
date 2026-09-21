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
    { url: BASE_URL },
    { url: `${BASE_URL}/series` },
    { url: `${BASE_URL}/podcasts` },
    { url: `${BASE_URL}/about` },
    { url: `${BASE_URL}/contact` },
    { url: `${BASE_URL}/privacy-policy` },
  ];

  const sectionPages: MetadataRoute.Sitemap = SECTIONS.map((sec) => ({
    url: `${BASE_URL}/${sec.slug}`,
  }));

  const seriesPages: MetadataRoute.Sitemap = ALL_SERIES.map((s) => ({
    url: `${BASE_URL}/series/${s.slug}`,
  }));

  // كل المواد المنشورة — storyHref المقدس /{section}/{id}/{slug} بترميز URL قياسي.
  const stories = await listSitemapEntries();
  const storyPages: MetadataRoute.Sitemap = stories.map((story) => ({
    url: `${BASE_URL}/${story.section}/${story.id}/${encodeURIComponent(story.slug)}`,
    lastModified: story.updatedAt ?? story.publishedAt ?? undefined,
  }));

  return [...staticPages, ...sectionPages, ...seriesPages, ...storyPages];
}
