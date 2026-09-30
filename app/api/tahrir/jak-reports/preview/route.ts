import { requirePermission } from "@/lib/tahrir/access";
import { buildJakDocument, jakDocumentHeaders } from "@/lib/jak-report-document";

export async function POST(request: Request) {
  const gate = await requirePermission("jak.manage");
  if (!gate.ok) return gate.response;
  // A form POST is allowed for iframe previews, but not cross-site submissions.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  let originHost = "";
  try { originHost = origin ? new URL(origin).host : ""; } catch { /* Invalid origins are rejected below. */ }
  if (!originHost || originHost !== host || request.headers.get("sec-fetch-site") === "cross-site") {
    return new Response("طلب المعاينة غير مسموح.", { status: 403 });
  }
  const data = await request.formData().catch(() => null);
  const html = data?.get("html");
  const css = data?.get("css") ?? "";
  const title = data?.get("title") ?? "معاينة التقرير";
  if (typeof html !== "string" || typeof css !== "string" || typeof title !== "string" || !html.trim() || new TextEncoder().encode(html).byteLength > 2 * 1024 * 1024 || new TextEncoder().encode(css).byteLength > 1024 * 1024 || title.length > 500) {
    return new Response("أكواد المعاينة غير صالحة أو تجاوزت الحجم المسموح.", { status: 400 });
  }
  return new Response(buildJakDocument({ html, css, title }), { headers: jakDocumentHeaders() });
}
