import { seedContentProvider } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";

/**
 * روابط المشاركة القديمة /share/{id}/{version} (سبتمبر 2026) تحوَّل نهائيًا إلى رابط المادة القانوني.
 * أدت الآلية غرضها المؤقت بعد نقل النطاق؛ لكل مادة اليوم رابط واحد.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const { id, version } = await params;
  const story = /^[A-Za-z0-9_-]{1,64}$/u.test(id) && /^\d{8}-\d{1,3}$/.test(version)
    ? await seedContentProvider.getStory(id)
    : null;
  if (!story) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(null, {
    status: 308,
    headers: {
      Location: encodeURI(storyHref(story)) + new URL(request.url).search,
      "Cache-Control": "public, max-age=300",
    },
  });
}

export const HEAD = GET;
