import { requireActor } from "@/lib/tahrir/access";
import { changeTeam, readTeam } from "@/lib/tahrir/editorial-team";
import { writeError } from "@/lib/tahrir/write-policy";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const gate = await requireActor(); if (!gate.ok) return gate.response;
  try { return Response.json(await readTeam((await params).id, gate.actor), { headers: { "Cache-Control": "no-store" } }); } catch (error) { return writeError(error); }
}
export async function POST(request: Request, { params }: Context) {
  const gate = await requireActor(); if (!gate.ok) return gate.response;
  try {
    const input = await request.json().catch(() => null);
    if (!input || typeof input !== "object" || Array.isArray(input)) return Response.json({ error: "طلب غير صحيح." }, { status: 400 });
    return Response.json(await changeTeam((await params).id, gate.actor, input));
  } catch (error) { return writeError(error); }
}
