import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://alelm.net",
      lastModified: new Date("2026-08-09"),
      changeFrequency: "hourly",
      priority: 1,
    },
  ];
}
