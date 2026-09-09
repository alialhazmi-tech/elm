import { requireActor } from "@/lib/tahrir/access";
import { leavePresence, updatePresence } from "@/lib/tahrir/editorial-team";
import { writeError } from "@/lib/tahrir/write-policy";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireActor(); if (!gate.ok) return gate.response;
  const input = await request.json().catch(() => null);
  try { return Response.json({ editors: await updatePresence((await params).id, gate.actor, typeof input?.sessionId === "string" ? input.sessionId : "") }); } catch (error) { return writeError(error); }
}

export async function DELETE(request: Request) {
  const gate = await requireActor(); if (!gate.ok) return gate.response;
  const input = await request.json().catch(() => null);
  try { await leavePresence(gate.actor, typeof input?.sessionId === "string" ? input.sessionId : ""); return Response.json({ ok: true }); } catch (error) { return writeError(error); }
}
