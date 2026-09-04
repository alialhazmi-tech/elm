import sharp from "sharp";
import { sharingOrigin } from "./sharing.ts";

export const MAX_SHARE_SOURCE_BYTES = 8 * 1024 * 1024;

/** لا نقبل عنوانًا حرًا من الطلب: الصور من مخزننا أو أرشيف الوسائط المعروف فقط. */
export function sharingImageSource(value: string): { filename: string } | { url: string } | null {
  try {
    const url = new URL(value, sharingOrigin());
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.origin === sharingOrigin()) {
      const match = /^\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp))$/i.exec(url.pathname);
      return match ? { filename: match[1] } : null;
    }
    if (url.protocol === "https:" && !url.port && url.hostname === "dash.alelm.net" && url.pathname.startsWith("/wp-content/uploads/")) return { url: url.href };
  } catch { /* رابط غير صالح؛ تستعمل البطاقة الافتراضية. */ }
  return null;
}

export async function sharingJpeg(bytes: Uint8Array, background = "#f8f7f4") {
  if (bytes.byteLength > MAX_SHARE_SOURCE_BYTES) throw new Error("Sharing image too large");
  // contain يحافظ على الإنفوجرافيك كاملًا؛ إزالة البيانات الوصفية والترميز إلى sRGB/JPEG.
  return sharp(bytes, { limitInputPixels: 40_000_000, animated: false })
    .rotate().resize(1200, 630, { fit: "contain", background })
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
