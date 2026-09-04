import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { seedContentProvider } from "@/lib/content/provider";
import { getStoredImage } from "@/lib/storage/images";
import { readSharingResponse, sharingImageSource, sharingJpeg } from "@/lib/sharing-image";

export const runtime = "nodejs";
const cache = new Map<string, { bytes: Buffer; expires: number }>();
let fallback: Promise<Buffer> | undefined;

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const match = /^([a-z0-9_-]{1,64})\.jpg$/i.exec(filename);
  if (!match) return new Response(null, { status: 404 });
  // مزود القراءة العامة يستبعد المسودات والمواد المؤرشفة.
  const story = await seedContentProvider.getStory(match[1]);
  if (!story) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const source = story.image ? sharingImageSource(story.image) : null;
  let bytes: Buffer | undefined;
  let isFallback = false;
  if (source) {
    const key = JSON.stringify(source);
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) bytes = cached.bytes;
    else {
      try {
        const input = "filename" in source
          ? (await getStoredImage(source.filename)).bytes
          : await readSharingResponse(await fetch(source.url, { redirect: "error", signal: AbortSignal.timeout(8000) }));
        bytes = await sharingJpeg(input);
        if (cache.size >= 32) cache.delete(cache.keys().next().value!);
        cache.set(key, { bytes, expires: Date.now() + 300_000 });
      } catch { /* تعذر المصدر: شعار العلم، دون حفظ البديل كصورة دائمة للخبر. */ }
    }
  }
  if (!bytes) {
    isFallback = true;
    fallback ??= readFile(join(process.cwd(), "public", "og.png")).then(sharingJpeg).catch(error => { fallback = undefined; throw error; });
    bytes = await fallback;
  }
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": "image/jpeg",
    "Content-Length": String(bytes.byteLength),
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": isFallback ? "public, max-age=60" : "public, max-age=3600, s-maxage=86400",
  } });
}
