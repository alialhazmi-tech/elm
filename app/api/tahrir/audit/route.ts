import { requirePermission } from "@/lib/tahrir/access";
import { appAudit } from "@/lib/tahrir/app-read";

export async function GET(request: Request) {
  const gate = await requirePermission("audit.view");
  if (!gate.ok) return gate.response;
  const result = await appAudit(new URL(request.url).searchParams.get("limit")).catch(() => null);
  if (!result) return Response.json({ error: "تعذر تحميل سجل التدقيق الآن." }, { status: 503 });
  return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
