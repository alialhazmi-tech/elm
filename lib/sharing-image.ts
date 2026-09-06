import sharp from "sharp";
import { sharingOrigin } from "./sharing.ts";
import { publicImageSource } from "./image-source.ts";

export const MAX_SHARE_SOURCE_BYTES = 8 * 1024 * 1024;

/** لا نقبل عنوانًا حرًا من الطلب: الصور من مخزننا أو أرشيف الوسائط المعروف فقط. */
export function sharingImageSource(value: string): { filename: string } | { url: string } | null {
  return publicImageSource(value, sharingOrigin());
}

export async function sharingJpeg(bytes: Uint8Array, background = "#f8f7f4", fit: "cover" | "contain" = "contain") {
  if (bytes.byteLength > MAX_SHARE_SOURCE_BYTES) throw new Error("Sharing image too large");
  // الأخبار تملأ الإطار دون تشويه، والإنفوجرافيك والشعار يبقيان كاملين.
  return sharp(bytes, { limitInputPixels: 40_000_000, animated: false })
    .rotate().resize(1200, 630, { fit, position: "centre", background })
    .flatten({ background }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}

export async function readSharingResponse(response: Response): Promise<Uint8Array> {
  if (!response.ok || !/^image\/(jpeg|png|webp|gif|avif)(?:;|$)/i.test(response.headers.get("Content-Type") ?? "")) throw new Error("Sharing image unavailable");
  if (Number(response.headers.get("Content-Length")) > MAX_SHARE_SOURCE_BYTES) throw new Error("Sharing image too large");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty sharing image");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_SHARE_SOURCE_BYTES) throw new Error("Sharing image too large");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}
