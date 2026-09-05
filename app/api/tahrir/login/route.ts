import { verifyMfa } from "@/lib/tahrir/mfa";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { createSessionToken, sessionCookie, verifyPassword } from "@/lib/tahrir/auth";
import { audit, findUser } from "@/lib/tahrir/service";

export async function POST(request: Request) {
  const { username, password, code } = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
    code?: string;
  };

  if (typeof username !== "string" || typeof password !== "string" || !username || !password || username.length > 190 || password.length > 512) {
    return NextResponse.json({ error: "أدخل اسم المستخدم وكلمة المرور." }, { status: 400 });
  }

  if (!process.env.AUTH_SECRET) {
    return NextResponse.json(
      { error: "اللوحة غير مهيأة: AUTH_SECRET غير معرّف على الخادم." },
      { status: 503 },
    );
  }

  // أُوقف حظر تكرار محاولات الدخول مؤقتًا بطلب الإدارة.
  const user = await findUser(username.trim());
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
  }
  // التعليق يُفحص بعد التحقق من كلمة المرور كي لا يكشف وجود الحساب لمن لا يملكها.
  if (user.status === "suspended") {
    await audit(user.username, "login:suspended");
    return NextResponse.json({ error: "عضويتك معلّقة — راجع مسؤول النظام." }, { status: 403 });
  }

  if (user.mfaSecret) {
    if (typeof code !== "string" || !code) return NextResponse.json({ error: "أدخل رمز تطبيق التحقق أو رمز استرداد.", mfaRequired: true }, { status: 401 });
    try {
      if (code.length > 64 || !await verifyMfa(user, code.trim())) return NextResponse.json({ error: "رمز التحقق غير صحيح أو استُخدم.", mfaRequired: true }, { status: 401 });
    } catch { return NextResponse.json({ error: "خدمة التحقق غير متاحة مؤقتًا." }, { status: 503 }); }
  }
  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });
  if (!token) {
    return NextResponse.json({ error: "تعذر إنشاء الجلسة." }, { status: 503 });
  }

  await Promise.all([
    audit(user.username, "login"),
    getDb()?.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id)),
  ]);

  const response = NextResponse.json({ ok: true, mustChangePassword: user.mustChangePassword === 1 });
  response.headers.set("Set-Cookie", sessionCookie(token));
  return response;
}
