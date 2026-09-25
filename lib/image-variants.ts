import sharp from "sharp";
import { MAX_SHARE_SOURCE_BYTES } from "./sharing-image.ts";
import { DEFAULT_IMAGE_QUALITY, imageQualityForSource } from "./image-source.ts";

/** يحفظ نسبة الأصل ولا يكبّر صورة صغيرة؛ القصّ من مسؤولية إطار العرض. */
export async function resizeEditorialImage(input: Uint8Array, width: number, quality = DEFAULT_IMAGE_QUALITY) {
  if (input.byteLength > MAX_SHARE_SOURCE_BYTES) throw new Error("Image source too large");
  return sharp(input, { limitInputPixels: 40_000_000, animated: false })
    .rotate().resize({ width, withoutEnlargement: true }).webp({ quality: imageQualityForSource("", quality) }).toBuffer();
}

/** كاش محدود بالبايتات والعدد، مع توحيد الطلبات المتزامنة للصورة نفسها. */
export function createImageVariantCache() {
  const cache = new Map<string, { bytes: Buffer; expires: number }>();
  const pending = new Map<string, Promise<Buffer>>();
  const queue: Array<() => void> = [];
  let active = 0;
  let bytesUsed = 0;
  return async (key: string, render: () => Promise<Buffer>): Promise<Buffer | null> => {
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.bytes;
    if (cached) { cache.delete(key); bytesUsed -= cached.bytes.byteLength; }
    const running = pending.get(key);
    if (running) return running;
    // عند الضغط نعرض الأصل بدل تكديس عمليات فكّ وترميز كبيرة في الذاكرة.
    if (pending.size >= 32) return null;
    const task = (async () => {
      if (active >= 2) await new Promise<void>((resolve) => queue.push(resolve));
      else active++;
      try {
        const bytes = await render();
        if (bytes.byteLength <= 16 * 1024 * 1024) {
          while (cache.size >= 128 || bytesUsed + bytes.byteLength > 16 * 1024 * 1024) {
            const oldest = cache.keys().next().value!;
            bytesUsed -= cache.get(oldest)!.bytes.byteLength;
            cache.delete(oldest);
          }
          cache.set(key, { bytes, expires: Date.now() + 3600_000 });
          bytesUsed += bytes.byteLength;
        }
        return bytes;
      } finally {
        const next = queue.shift();
        if (next) next();
        else active--;
      }
    })().finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  };
}
