import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { deleteRole, updateRole } from "@/lib/tahrir/admin";
import { adminErrorResponse, type IdContext } from "@/lib/tahrir/adminRoute";

export async function PATCH(request: Request, context: IdContext) {
  const gate = await requirePermission("roles.manage");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;

  const input = (await request.json().catch(() => null)) as { label?: string; description?: string } | null;
  if (!input) return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });

  try {
    await updateRole(id, input, gate.actor.username);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

/** حذف دور غير نظامي بلا أعضاء. */
export async function DELETE(_request: Request, context: IdContext) {
  const gate = await requirePermission("roles.manage");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;

  try {
    await deleteRole(id, gate.actor.username);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
