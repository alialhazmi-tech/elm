import { getPublishedJakReportByPublicId } from "@/lib/tahrir/jak-reports";
import { jakReportHref } from "@/lib/jak-urls";

export const dynamic = "force-dynamic";

function missingReport() {
  return new Response("التقرير غير موجود.", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function redirectToCanonical(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const report = await getPublishedJakReportByPublicId((await params).id);
  if (!report) return missingReport();
  return new Response(null, {
    status: 301,
    headers: {
      Location: jakReportHref(report) + new URL(request.url).search,
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return redirectToCanonical(request, context);
}

export async function HEAD(request: Request, context: { params: Promise<{ id: string }> }) {
  return redirectToCanonical(request, context);
}
