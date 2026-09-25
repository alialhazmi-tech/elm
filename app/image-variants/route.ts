import { DEFAULT_IMAGE_QUALITY, imageQualityForSource, imageVariantSource, IMAGE_QUALITIES, IMAGE_WIDTHS } from "@/lib/image-source";
import { createImageVariantCache, resizeEditorialImage } from "@/lib/image-variants";
import { getStoredImage, isMissingStoredImage } from "@/lib/storage/images";
import { readSharingResponse } from "@/lib/sharing-image";

export const runtime = "nodejs";
const renderCached = createImageVariantCache();

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const value = params.get("src") ?? "";
  const source = value.length <= 2048 ? imageVariantSource(value) : null;
  const width = Number(params.get("w"));
  const requestedQuality = params.get("q");
  const quality = requestedQuality === null
    ? DEFAULT_IMAGE_QUALITY
    : Number(requestedQuality);
  if (!source || !IMAGE_WIDTHS.includes(width) || !IMAGE_QUALITIES.includes(quality as (typeof IMAGE_QUALITIES)[number])) {
    return new Response(null, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const original = "filename" in source ? `/uploads/${source.filename}` : source.url;
  try {
    const effectiveQuality = imageQualityForSource(original, quality);
    const bytes = await renderCached(`${original}:${width}:q${effectiveQuality}`, async () => {
      const input = "filename" in source
        ? (await getStoredImage(source.filename)).bytes
        : await readSharingResponse(await fetch(source.url, { redirect: "error", signal: AbortSignal.timeout(8000) }));
      return resizeEditorialImage(input, width, effectiveQuality);
    });
    if (bytes) return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if (isMissingStoredImage(error)) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    console.error("[image-variants] تعذر تجهيز نسخة الصورة:", error);
  }
  // المصدر موثوق ومحدد أعلاه؛ تعطل التحسين لا يكسر الصورة ولا يُخزّن كنجاح دائم.
  return new Response(null, { status: 307, headers: { Location: original, "Cache-Control": "no-store" } });
}
