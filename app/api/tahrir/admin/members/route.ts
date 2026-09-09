import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { createMember, listMembers } from "@/lib/tahrir/admin";
import { adminErrorResponse } from "@/lib/tahrir/adminRoute";

export async function GET() {
  const gate = await requirePermission("users.view");
  if (!gate.ok) return gate.response;
  return NextResponse.json({ members: await listMembers() });
}

/** إضافة عضو بكلمة مرور مؤقتة يُجبر على تغييرها عند أول دخول. */
export async function POST(request: Request) {
  const gate = await requirePermission("users.manage");
  if (!gate.ok) return gate.response;

  const input = (await request.json().catch(() => null)) as {
    username?: string;
    displayName?: string;
    email?: string;
    role?: string;
    password?: string;
  } | null;
  if (!input?.username || !input.displayName || !input.role || !input.password) {
    return NextResponse.json({ error: "اسم المستخدم والاسم والدور وكلمة المرور مطلوبة." }, { status: 400 });
  }

  try {
    const id = await createMember(
      {
        username: input.username,
        displayName: input.displayName,
        email: input.email ?? "",
        role: input.role,
        password: input.password,
      },
      gate.actor,
    );
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
