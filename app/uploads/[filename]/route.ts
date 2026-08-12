import { getStoredImage, headStoredImage, isMissingStoredImage } from "@/lib/storage/images";

export const runtime = "nodejs";

const imageHeaders = (image: { contentType: string; cacheControl: string; etag?: string }) => ({
  "Content-Type": image.contentType,
  "Cache-Control": image.cacheControl,
  "Content-Disposition": "inline",
  "X-Content-Type-Options": "nosniff",
  ...(image.etag ? { ETag: image.etag } : {}),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    const image = await getStoredImage(filename);
    return new Response(Buffer.from(image.bytes), {
      headers: imageHeaders(image),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "اسم ملف الصورة غير صالح.") {
      return new Response("Not found", { status: 404 });
    }
    if (isMissingStoredImage(error)) return new Response("Not found", { status: 404 });
    return new Response("تعذر تحميل الصورة.", { status: 502 });
  }
}

export async function HEAD(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    const image = await headStoredImage(filename);
    return new Response(null, {
      headers: {
        ...imageHeaders(image),
        ...(image.contentLength === undefined ? {} : { "Content-Length": String(image.contentLength) }),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "اسم ملف الصورة غير صالح.") {
      return new Response(null, { status: 404 });
    }
    if (isMissingStoredImage(error)) return new Response(null, { status: 404 });
    return new Response(null, { status: 502 });
  }
}
