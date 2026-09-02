import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { setMediaRights } from "@/lib/tahrir/service";

/** توثيق حقوق صورة أو سحبه — من صلاحية المعتمدين (الدستور §12). */
export async function POST(request: Request) {
  const gate = await requirePermission("media.rights", "توثيق الحقوق من صلاحية المعتمدين.");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const { id, rightsCleared, flags } = (await request.json().catch(() => ({}))) as {
    id?: string;
    rightsCleared?: boolean;
    flags?: string;
  };
  if (!id) return NextResponse.json({ error: "معرف الصورة مطلوب." }, { status: 400 });

  await setMediaRights(id, rightsCleared === true, flags ?? "", session.username);
  return NextResponse.json({ ok: true });
}
