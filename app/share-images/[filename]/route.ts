import { brandSharingImage } from "@/lib/brand-sharing-image";
import { seedContentProvider } from "@/lib/content/provider";
import { getJakReport } from "@/lib/tahrir/jak-reports";
import { getStoredImage } from "@/lib/storage/images";
import { readSharingResponse, sharingImageSource, sharingJpeg } from "@/lib/sharing-image";
import { sharingImageFit } from "@/lib/sharing-contract";

export const runtime = "nodejs";
const cache = new Map<string, { bytes: Buffer; expires: number }>();
const JAK_ID = /^jak-report-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const match = /^([a-z0-9_-]{1,64})(?:\.v[a-z0-9-]{1,64})?\.jpg$/i.exec(filename);
  if (!match) return new Response(null, { status: 404 });
  // معرّف تقرير جاك العام ثابت، لكن لا نكشف إلا التقرير المنشور.
  const jakId = JAK_ID.exec(match[1]);
  const jakReport = jakId ? await getJakReport(jakId[1].toLowerCase()) : null;
  if (jakId && (!jakReport || jakReport.status !== "published")) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  // مزود القراءة العامة يستبعد المسودات والمواد المؤرشفة.
  const story = jakReport
    ? { image: jakReport.image ?? undefined, format: "jakalelm" }
    : await seedContentProvider.getStory(match[1]);
  if (!story) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const source = story.image ? sharingImageSource(story.image) : null;
  const fit = sharingImageFit(story);
  let bytes: Buffer | undefined;
  let isFallback = false;
  if (source) {
    const key = JSON.stringify({ source, fit });
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) bytes = cached.bytes;
    else {
      try {
        const input = "filename" in source
          ? (await getStoredImage(source.filename)).bytes
          : await readSharingResponse(await fetch(source.url, { redirect: "error", signal: AbortSignal.timeout(8000) }), {
            allowMissingContentType: new URL(source.url).hostname === "jakelelm.alelm.net",
          });
        bytes = await sharingJpeg(input, undefined, fit);
        if (cache.size >= 32) cache.delete(cache.keys().next().value!);
        cache.set(key, { bytes, expires: Date.now() + 300_000 });
      } catch { /* نرفض الفشل أدناه بدل تثبيت الشعار في كاش المنصة كصورة للخبر. */ }
    }
  }
  if (!bytes && story.image) {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
  if (!bytes) {
    isFallback = true;
    bytes = await brandSharingImage();
  }
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": "image/jpeg",
    "Content-Length": String(bytes.byteLength),
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": isFallback ? "public, max-age=60" : "public, max-age=3600, s-maxage=86400",
  } });
}
