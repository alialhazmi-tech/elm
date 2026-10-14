import { PUBLIC_CONTENT_CACHE_CONTROL } from "@/lib/content/cache-policy";
import { CONTENT_SIGNAL, DISCOVERY_LINKS } from "./discovery";

export function publicJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: {
    "Cache-Control": status === 200 ? PUBLIC_CONTENT_CACHE_CONTROL : "no-store",
    "Content-Signal": CONTENT_SIGNAL, Link: DISCOVERY_LINKS,
    "X-Robots-Tag": "noindex", // Canonical HTML articles remain the search landing pages.
  } });
}

export function unavailable() {
  console.error("[agents] public_content_read_failed");
  return Response.json({ error: "Public content temporarily unavailable" }, {
    status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" },
  });
}
