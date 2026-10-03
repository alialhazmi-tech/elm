import { getPublishedJakReportByPublicId } from "@/lib/tahrir/jak-reports";
import { buildPublicJakDocument, publicJakDocumentHeaders } from "@/lib/jak-public-document";
import { isMobileJakReader } from "@/lib/jak-report-document";
import { jakReportHref, publicJakReportId } from "@/lib/jak-urls";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; slug: string }> };

async function respond(request: Request, { params }: Context, head: boolean) {
  const { id, slug } = await params;
  const report = await getPublishedJakReportByPublicId(id);
  const headers = publicJakDocumentHeaders();
  // Route headers take precedence over next.config headers; keep the existing
  // hosting-domain noindex policy when serving the standalone document there.
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (/\.up\.railway\.app(?::\d+)?$/i.test(host)) headers["X-Robots-Tag"] = "noindex, nofollow";
  if (!report) {
    return new Response(head ? null : "التقرير غير موجود.", {
      status: 404,
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  let decodedSlug = slug;
  try { decodedSlug = decodeURIComponent(slug); } catch { /* Malformed aliases redirect to the canonical URL. */ }
  if (decodedSlug !== report.slug || id !== publicJakReportId(report)) {
    return new Response(null, {
      status: 308,
      headers: { ...headers, Location: jakReportHref(report) + new URL(request.url).search },
    });
  }
  // This is a standalone document, not part of the application's React tree.
  // The response CSP keeps scripts in an opaque origin while crawlers receive
  // the report's actual HTML at its canonical public URL, without an iframe.
  return new Response(head ? null : buildPublicJakDocument(report, {
    mobile: isMobileJakReader(request.headers.get("user-agent") ?? ""),
  }), { headers: { ...headers, Vary: "User-Agent" } });
}

export async function GET(request: Request, context: Context) {
  return respond(request, context, false);
}

export async function HEAD(request: Request, context: Context) {
  return respond(request, context, true);
}
