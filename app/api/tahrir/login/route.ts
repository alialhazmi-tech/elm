import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { createSessionToken, sessionCookie, verifyPassword } from "@/lib/tahrir/auth";
import { audit, findUser } from "@/lib/tahrir/service";

export async function POST(request: Request) {
  const { username, password } = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return NextResponse.json({ error: "أدخل اسم المستخدم وكلمة المرور." }, { status: 400 });
  }

  if (!process.env.AUTH_SECRET) {
    return NextResponse.json(
      { error: "اللوحة غير مهيأة: AUTH_SECRET غير معرّف على الخادم." },
      { status: 503 },
    );
  }

  const user = await findUser(username.trim());
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
  }
  // التعليق يُفحص بعد التحقق من كلمة المرور كي لا يكشف وجود الحساب لمن لا يملكها.
  if (user.status === "suspended") {
    await audit(user.username, "login:suspended");
    return NextResponse.json({ error: "عضويتك معلّقة — راجع مسؤول النظام." }, { status: 403 });
  }

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
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
