import { getJakReport } from "@/lib/tahrir/jak-reports";
import { loadActor } from "@/lib/tahrir/access";
import { assertCanWrite } from "@/lib/tahrir/write-policy";
import { buildJakDocument, isMobileJakReader, jakDocumentHeaders } from "@/lib/jak-report-document";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const report = await getJakReport((await params).id);
  if (!report) return new Response("التقرير غير موجود.", { status: 404 });
  if (report.status !== "published") {
    const actor = await loadActor();
    if (!actor || actor.mustChangePassword || actor.mfaRequired || !actor.can("jak.manage")) return new Response("التقرير غير موجود.", { status: 404, headers: { "Cache-Control": "private, no-store" } });
    try { assertCanWrite(actor, report); } catch { return new Response("التقرير غير موجود.", { status: 404, headers: { "Cache-Control": "private, no-store" } }); }
  }
  return new Response(buildJakDocument(report, { mobile: isMobileJakReader(request.headers.get("user-agent") ?? "") }), { headers: { ...jakDocumentHeaders(), Vary: "User-Agent" } });
}
