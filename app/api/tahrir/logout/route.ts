import { eq, sql, and } from "drizzle-orm";
import { NextResponse } from "next/server";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { clearSessionCookie, getSession } from "@/lib/tahrir/auth";
import { audit } from "@/lib/tahrir/service";

/**
 * الخروج يبطل الرمز لا يمحو الكوكي فحسب: رفع session_version يجعل كل رمز صادر قبل الآن مرفوضًا
 * (بما فيها نسخ الجلسة على أجهزة أخرى) — الرمز الموقَّع بلا هذا يبقى صالحًا 12 ساعة بعد «الخروج».
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  const session = await getSession();
  const db = getDb();
  if (session && db) {
    const revoked = await db
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(and(eq(users.id, session.userId), eq(users.sessionVersion, session.sessionVersion ?? 0)))
      .returning({ username: users.username })
      .catch(() => []);
    if (revoked[0]) await audit(revoked[0].username, "logout").catch(() => null);
  }
  return response;
}
