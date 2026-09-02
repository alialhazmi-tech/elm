import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { setRolePermission } from "@/lib/tahrir/admin";
import { adminErrorResponse, type IdContext } from "@/lib/tahrir/adminRoute";

/** تبديل مربّع واحد في المصفوفة — يسري خلال 30 ثانية على كل الجلسات. */
export async function PATCH(request: Request, context: IdContext) {
  const gate = await requirePermission("roles.manage");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;

  const { permissionKey, granted } = (await request.json().catch(() => ({}))) as {
    permissionKey?: string;
    granted?: boolean;
  };
  if (!permissionKey || typeof granted !== "boolean") {
    return NextResponse.json({ error: "مفتاح الصلاحية والحالة مطلوبان." }, { status: 400 });
  }

  try {
    await setRolePermission(id, permissionKey, granted, gate.actor.username);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
