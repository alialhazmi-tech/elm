import { requireActor } from "@/lib/tahrir/access";
import { appTasks } from "@/lib/tahrir/app-read";

export async function GET(request: Request) {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;
  const params = new URL(request.url).searchParams;
  return Response.json(await appTasks(gate.actor, { filter: params.get("filter"), page: params.get("page") }), { headers: { "Cache-Control": "private, no-store" } });
}
