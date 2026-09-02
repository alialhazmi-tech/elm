import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { setMemberOverrides } from "@/lib/tahrir/admin";
import { adminErrorResponse, type IdContext } from "@/lib/tahrir/adminRoute";
import type { OverrideEffect } from "@/lib/tahrir/permissions";

/** الاستثناءات الفردية فوق الدور — تُستبدل القائمة كاملة. */
export async function PUT(request: Request, context: IdContext) {
  const gate = await requirePermission("roles.manage");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;

  const { overrides } = (await request.json().catch(() => ({}))) as {
    overrides?: Array<{ permissionKey?: string; effect?: OverrideEffect }>;
  };
  if (!Array.isArray(overrides)) return NextResponse.json({ error: "قائمة الاستثناءات مطلوبة." }, { status: 400 });

  try {
    await setMemberOverrides(
      id,
      overrides
        .filter((o): o is { permissionKey: string; effect: OverrideEffect } => typeof o?.permissionKey === "string" && !!o.effect)
        .slice(0, 100),
      gate.actor.username,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
