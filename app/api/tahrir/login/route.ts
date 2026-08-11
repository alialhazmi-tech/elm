import { NextResponse } from "next/server";

import { createSessionToken, sessionCookie, verifyPassword, type Role } from "@/lib/tahrir/auth";
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

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role as Role,
  });
  if (!token) {
    return NextResponse.json({ error: "تعذر إنشاء الجلسة." }, { status: 503 });
  }

  await audit(user.username, "login");

  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", sessionCookie(token));
  return response;
}
