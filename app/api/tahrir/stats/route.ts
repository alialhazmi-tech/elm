import { requirePermission } from "@/lib/tahrir/access";
import { appStats } from "@/lib/tahrir/app-read";

export async function GET() {
  const gate = await requirePermission("stats.view");
  if (!gate.ok) return gate.response;
  return Response.json(await appStats(), { headers: { "Cache-Control": "private, no-store" } });
}
