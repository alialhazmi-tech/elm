import { requireActor } from "@/lib/tahrir/access";
import { appOverview } from "@/lib/tahrir/app-read";

export async function GET() {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;
  return Response.json(await appOverview(gate.actor), { headers: { "Cache-Control": "private, no-store" } });
}
