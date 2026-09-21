import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { createRole, listRoles } from "@/lib/tahrir/admin";
import { adminErrorResponse } from "@/lib/tahrir/adminRoute";
import { PERMISSION_GROUPS } from "@/lib/tahrir/permissions";

export async function GET() {
  const gate = await requirePermission("users.view");
  if (!gate.ok) return gate.response;
  return NextResponse.json({ roles: await listRoles(), groups: PERMISSION_GROUPS });
}

/** دور جديد — يبدأ فارغًا أو نسخة من دور قائم. */
export async function POST(request: Request) {
  const gate = await requirePermission("roles.manage");
  if (!gate.ok) return gate.response;

  const input = (await request.json().catch(() => null)) as {
    id?: string;
    label?: string;
    description?: string;
    copyFrom?: string;
  } | null;
  if (!input?.id || !input.label) return NextResponse.json({ error: "المعرّف والاسم مطلوبان." }, { status: 400 });

  try {
    await createRole({ id: input.id, label: input.label, description: input.description, copyFrom: input.copyFrom }, gate.actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
