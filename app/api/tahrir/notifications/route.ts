import { and, eq, inArray } from "drizzle-orm";
import { editorialNotifications } from "@/db/schema";
import { requireActor } from "@/lib/tahrir/access";
import { myNotifications } from "@/lib/tahrir/editorial-team";
import { workflowDb } from "@/lib/tahrir/workflow";
export async function GET() {
  const gate = await requireActor(); if (!gate.ok) return gate.response;
  return Response.json({ notifications: await myNotifications(gate.actor) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const gate = await requireActor(); if (!gate.ok) return gate.response;
  const input = await request.json().catch(() => null);
  if (!Array.isArray(input?.ids) || !input.ids.length || input.ids.length > 30 || input.ids.some((id: unknown) => typeof id !== "string")) return Response.json({ error: "طلب غير صحيح." }, { status: 400 });
  await workflowDb().update(editorialNotifications).set({ readAt: new Date().toISOString() }).where(and(eq(editorialNotifications.userId, gate.actor.userId), inArray(editorialNotifications.id, input.ids)));
  return Response.json({ ok: true });
}
