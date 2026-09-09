import { requireActor } from "@/lib/tahrir/access";
import { storyTimeline } from "@/lib/tahrir/story-timeline";
import { writeError } from "@/lib/tahrir/write-policy";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireActor(); if (!gate.ok) return gate.response;
  const query = new URL(request.url).searchParams;
  const eventId = query.get("eventId");
  if (eventId && eventId.length > 100) return Response.json({ error: "معرف الحدث غير صحيح." }, { status: 400 });
  try { return Response.json(await storyTimeline((await params).id, gate.actor, { cursor: query.get("cursor"), eventId }), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return writeError(error); }
}
