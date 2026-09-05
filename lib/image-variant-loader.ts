"use client";

import { imageVariantUrl } from "./image-source";

export default function imageVariantLoader({ src, width }: { src: string; width: number }) {
  return imageVariantUrl(src, width);
}
