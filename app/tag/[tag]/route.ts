import { TAG_TO_SERIES } from "@/lib/content/redirects";

/**
 * أرشيفات الوسوم القديمة /tag/… — طبقة 301 تنفيذية (شرط M-2):
 * وسم سلسلة → صفحة السلسلة، وأي وسم آخر → البحث المعرفي باسمه.
 * مسار route لا redirects() لأن مصادر next.config لا تلتقط المقاطع العربية بثبات.
 */

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const redirect = (location: string) =>
  new Response(null, {
    status: 301,
    headers: { Location: location, "Cache-Control": "public, max-age=3600" },
  });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tag: string }> },
) {
  const { tag } = await params;
  const decoded = safeDecode(tag).replace(/^#/u, "").trim();
  const series =
    TAG_TO_SERIES[decoded] ??
    TAG_TO_SERIES[decoded.replace(/-/gu, "_")] ??
    TAG_TO_SERIES[decoded.replace(/_/gu, "-")];
  if (series) return redirect(`/series/${series}`);
  // وسوم حرة من الإرث — وجهتها البحث حتى لا يضيع زائر قادم من رابط قديم.
  const query = decoded.replace(/[-_]/gu, " ");
  return redirect(`/search?q=${encodeURIComponent(query)}`);
}
