import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { resetMemberPassword } from "@/lib/tahrir/admin";
import { adminErrorResponse, type IdContext } from "@/lib/tahrir/adminRoute";

/** كلمة مرور مؤقتة من المسؤول — العضو يُجبر على تغييرها عند الدخول التالي. */
export async function POST(request: Request, context: IdContext) {
  const gate = await requirePermission("users.manage");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;

  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!password) return NextResponse.json({ error: "كلمة المرور مطلوبة." }, { status: 400 });

  try {
    await resetMemberPassword(id, password, gate.actor.username);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
