import { NextResponse } from "next/server";

import { APPROVER_ROLES, getSession } from "@/lib/tahrir/auth";
import { setMediaRights } from "@/lib/tahrir/service";

/** توثيق حقوق صورة أو سحبه — من صلاحية المعتمدين (الدستور §12). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });
  if (!APPROVER_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "توثيق الحقوق من صلاحية المعتمدين." }, { status: 403 });
  }

  const { id, rightsCleared, flags } = (await request.json().catch(() => ({}))) as {
    id?: string;
    rightsCleared?: boolean;
    flags?: string;
  };
  if (!id) return NextResponse.json({ error: "معرف الصورة مطلوب." }, { status: 400 });

  await setMediaRights(id, rightsCleared === true, flags ?? "", session.username);
  return NextResponse.json({ ok: true });
}
