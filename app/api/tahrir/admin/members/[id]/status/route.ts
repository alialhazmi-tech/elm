import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { setMemberStatus } from "@/lib/tahrir/admin";
import { adminErrorResponse, type IdContext } from "@/lib/tahrir/adminRoute";

/** تعليق العضوية أو استئنافها — يسري فورًا على كل طلب لاحق للعضو. */
export async function POST(request: Request, context: IdContext) {
  const gate = await requirePermission("users.suspend");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;

  const { status, reason } = (await request.json().catch(() => ({}))) as { status?: string; reason?: string };
  if (status !== "active" && status !== "suspended") {
    return NextResponse.json({ error: "الحالة active أو suspended." }, { status: 400 });
  }

  try {
    await setMemberStatus(id, status, reason ?? "", gate.actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
