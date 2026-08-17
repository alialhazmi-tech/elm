import type { MetadataRoute } from "next";
import { ALL_SERIES } from "@/lib/content/series";
import { SECTIONS } from "@/lib/content/sections";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://alelm.net";
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/series`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  const sectionPages: MetadataRoute.Sitemap = SECTIONS.map((sec) => ({
    url: `${baseUrl}/${sec.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: sec.navPriority === 1 ? 0.9 : 0.8,
  }));

  const seriesPages: MetadataRoute.Sitemap = ALL_SERIES.map((s) => ({
    url: `${baseUrl}/series/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: s.archived ? 0.6 : 0.85,
  }));

  return [...staticPages, ...sectionPages, ...seriesPages];
}

