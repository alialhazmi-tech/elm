import { writeError } from "@/lib/tahrir/write-policy";
import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { restoreArchived } from "@/lib/tahrir/service";

export async function POST(request: Request) {
  try { return await transition(request); } catch (error) { return writeError(error); }
}
async function transition(request: Request) {
  const gate = await requirePermission("story.restore", "الاستعادة من صلاحية المعتمدين ورئيس التحرير.");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

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
