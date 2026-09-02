import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { updateMember } from "@/lib/tahrir/admin";
import { adminErrorResponse, type IdContext } from "@/lib/tahrir/adminRoute";

export async function PATCH(request: Request, context: IdContext) {
  const gate = await requirePermission("users.manage");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;

  const input = (await request.json().catch(() => null)) as {
    displayName?: string;
    email?: string;
    role?: string;
  } | null;
  if (!input) return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });

  try {
    await updateMember(id, input, gate.actor.username);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
