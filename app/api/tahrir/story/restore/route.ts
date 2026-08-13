import { NextResponse } from "next/server";

import { APPROVER_ROLES, getSession } from "@/lib/tahrir/auth";
import { restoreArchived } from "@/lib/tahrir/service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });
  if (!APPROVER_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "الاستعادة من صلاحية المعتمدين ورئيس التحرير." }, { status: 403 });
  }

  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id?.trim()) return NextResponse.json({ error: "معرف المادة مطلوب." }, { status: 400 });

  const result = await restoreArchived(id.trim(), session.username);
  if (result === "not-found") {
    return NextResponse.json({ error: "المادة غير موجودة." }, { status: 404 });
  }
  if (result === "not-archived") {
    return NextResponse.json({ error: "المادة ليست في الأرشيف." }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
