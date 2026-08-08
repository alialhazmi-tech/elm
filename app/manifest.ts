import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "العلم",
    short_name: "العلم",
    description: "منصة إعلام ومعرفة سعودية",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1e8",
    theme_color: "#102e4f",
    lang: "ar",
    dir: "rtl",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
