import { NextResponse } from "next/server";

import { requireActor } from "@/lib/tahrir/access";
import { AdminError, changeOwnPassword } from "@/lib/tahrir/admin";
import { verifyPassword } from "@/lib/tahrir/auth";
import { findUser } from "@/lib/tahrir/service";

/** العضو يغيّر كلمة مروره — إلزامي بعد كلمة مؤقتة، ومتاح دائمًا من حسابه. */
export async function POST(request: Request) {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;
  const actor = gate.actor;

  const { current, next } = (await request.json().catch(() => ({}))) as { current?: string; next?: string };
  if (!current || !next) return NextResponse.json({ error: "أدخل كلمة المرور الحالية والجديدة." }, { status: 400 });
  if (current === next) return NextResponse.json({ error: "اختر كلمة مرور مختلفة عن الحالية." }, { status: 400 });

  const user = await findUser(actor.username);
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة." }, { status: 401 });
  }

  try {
    await changeOwnPassword(actor.userId, next, actor.username);
  } catch (error) {
    if (error instanceof AdminError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  return NextResponse.json({ ok: true });
}
