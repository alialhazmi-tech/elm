import { and, eq, inArray } from "drizzle-orm";
import { editorialNotifications } from "@/db/schema";
import { requireActor } from "@/lib/tahrir/access";
import { myNotifications, notificationsEtag } from "@/lib/tahrir/editorial-team";
import { workflowDb } from "@/lib/tahrir/workflow";
export async function GET(request: Request) {
  const gate = await requireActor(); if (!gate.ok) return gate.response;
  const notifications = await myNotifications(gate.actor);
  // استطلاع شرطي: البصمة من المعرفات وحالة القراءة؛ لا حمولة ولا إعادة رسم عند عدم التغيير.
  const etag = await notificationsEtag(notifications);
  const headers = { "Cache-Control": "no-store", ETag: etag };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return Response.json({ notifications }, { headers });
}
export async function POST(request: Request) {
  const gate = await requireActor(); if (!gate.ok) return gate.response;
  const input = await request.json().catch(() => null);
  if (!Array.isArray(input?.ids) || !input.ids.length || input.ids.length > 30 || input.ids.some((id: unknown) => typeof id !== "string")) return Response.json({ error: "طلب غير صحيح." }, { status: 400 });
  await workflowDb().update(editorialNotifications).set({ readAt: new Date().toISOString() }).where(and(eq(editorialNotifications.userId, gate.actor.userId), inArray(editorialNotifications.id, input.ids)));
  return Response.json({ ok: true });
}
