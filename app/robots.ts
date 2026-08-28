import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: ["https://alelm.net/sitemap.xml", "https://alelm.net/sitemap-news.xml"],
    host: "https://alelm.net",
  };
}
