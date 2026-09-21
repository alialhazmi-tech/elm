import { requirePermission } from "@/lib/tahrir/access";
import { appSchedule } from "@/lib/tahrir/app-read";

export async function GET() {
  const gate = await requirePermission("story.schedule", "الجدولة من صلاحية المعتمدين.");
  if (!gate.ok) return gate.response;
  return Response.json(await appSchedule(gate.actor), { headers: { "Cache-Control": "private, no-store" } });
}
