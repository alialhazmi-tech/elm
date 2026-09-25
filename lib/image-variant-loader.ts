"use client";

import { imageVariantUrl } from "./image-source.ts";

export default function imageVariantLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  // Next supplies 75 when no quality prop was set. Keep the established 78
  // default; pages can opt into 60 for photographic lead images explicitly.
  return imageVariantUrl(src, width, quality === 75 ? undefined : quality);
}
