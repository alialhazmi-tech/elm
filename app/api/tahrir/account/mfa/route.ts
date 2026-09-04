import { and, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireActor } from "@/lib/tahrir/access";
import { createSessionToken, sessionCookie, verifyPassword } from "@/lib/tahrir/auth";
import { audit, findUser } from "@/lib/tahrir/service";
import { consumeLimit } from "@/lib/tahrir/rate-limit";
import { verifyMfa } from "@/lib/tahrir/mfa";
import { base32, matchingCounter, openMfa, recoveryHash, sealMfa } from "@/lib/tahrir/totp";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const gate = await requireActor(); if (!gate.ok) return gate.response;
  const input = await request.json().catch(() => null);
  if (typeof input?.password !== "string" || input.password.length > 512 || !["begin", "enable", "disable"].includes(input.action)) return json({ error: "طلب غير صالح." }, 400);
  try {
    if (!await consumeLimit("mfa-manage", gate.actor.userId, 10, 900)) return json({ error: "محاولات كثيرة؛ حاول لاحقًا." }, 429);
    const user = await findUser(gate.actor.username); const db = getDb();
    if (!user || !db || !await verifyPassword(input.password, user.passwordHash)) return json({ error: "كلمة المرور غير صحيحة." }, 401);
    if (input.action === "begin") {
      if (user.mfaSecret) return json({ error: "التحقق بخطوتين مفعّل بالفعل." }, 409);
      const secret = base32(crypto.getRandomValues(new Uint8Array(20)));
      const enrollment = await sealMfa(JSON.stringify({ secret, expires: Date.now() + 600_000, sessionVersion: user.sessionVersion }), `enroll:${user.id}`);
      return json({ secret, enrollment });
    }
    if (typeof input.code !== "string" || input.code.length > 64) return json({ error: "أدخل رمز التحقق." }, 400);
    let values: Partial<typeof users.$inferInsert>;
    let codes: string[] = [];
    if (input.action === "enable") {
      if (user.mfaSecret || typeof input.enrollment !== "string" || input.enrollment.length > 2000) return json({ error: "أعد بدء الإعداد." }, 409);
      const enrollment = JSON.parse(await openMfa(input.enrollment, `enroll:${user.id}`));
      if (enrollment.expires < Date.now() || enrollment.sessionVersion !== user.sessionVersion) return json({ error: "انتهت صلاحية الإعداد؛ ابدأ مجددًا." }, 409);
      const counter = await matchingCounter(enrollment.secret, input.code);
      if (counter === null) return json({ error: "رمز التحقق غير صحيح." }, 401);
      codes = Array.from({ length: 8 }, () => Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex").toUpperCase());
      values = { mfaSecret: await sealMfa(enrollment.secret, `secret:${user.id}`), mfaLastCounter: counter, mfaRecoveryHashes: await Promise.all(codes.map(code => recoveryHash(user.id, code))) };
    } else {
      if (!await verifyMfa(user, input.code)) return json({ error: "رمز التحقق غير صحيح أو استُخدم." }, 401);
      values = { mfaSecret: null, mfaLastCounter: -1, mfaRecoveryHashes: [] };
    }
    const [updated] = await db.update(users).set({ ...values, sessionVersion: sql`${users.sessionVersion}+1` }).where(and(eq(users.id, user.id), eq(users.sessionVersion, user.sessionVersion), input.action === "enable" ? isNull(users.mfaSecret) : eq(users.mfaSecret, user.mfaSecret!))).returning();
    if (!updated) return json({ error: "تغيّرت إعدادات الحساب؛ أعد تسجيل الدخول." }, 409);
    await audit(user.username, `mfa:${input.action}`);
    const token = await createSessionToken({ userId: updated.id, username: updated.username, displayName: updated.displayName, role: updated.role, sessionVersion: updated.sessionVersion });
    const response = json({ ok: true, enabled: Boolean(updated.mfaSecret), recoveryCodes: codes });
    if (token) response.headers.set("Set-Cookie", sessionCookie(token));
    return response;
  } catch { return json({ error: "تعذر إكمال إعداد التحقق بخطوتين. تحقق من جاهزية الخدمة وحاول مجددًا." }, 503); }
}
