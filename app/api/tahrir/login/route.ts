import { verifyMfa } from "@/lib/tahrir/mfa";
import { clearLimit, consumeLimit } from "@/lib/tahrir/rate-limit";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { createSessionToken, sessionCookie, verifyPassword } from "@/lib/tahrir/auth";
import { audit, findUser } from "@/lib/tahrir/service";

/** نافذة الحظر: 10 محاولات للحساب و40 للشبكة كل 15 دقيقة — أُعيدت بعد إيقافها المؤقت في #111. */
const WINDOW_SECONDS = 900;
const ACCOUNT_ATTEMPTS = 10;
const NETWORK_ATTEMPTS = 40;

/**
 * تجزئة وهمية بصيغة salt:iterations:hash تُفحص عند غياب الحساب كي يستغرق الرد الزمن نفسه
 * في الحالتين، فلا يُستدل على وجود اسم المستخدم من سرعة الرفض.
 */
const DUMMY_PASSWORD_HASH = `${"0".repeat(32)}:120000:${"0".repeat(64)}`;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

const tooMany = () =>
  NextResponse.json(
    { error: "محاولات كثيرة. حاول بعد 15 دقيقة." },
    { status: 429, headers: { "Retry-After": String(WINDOW_SECONDS) } },
  );

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

  // كل طلب دخول (كلمة مرور أو رمز تحقق) يستهلك محاولة من نافذة الحساب ونافذة الشبكة قبل أي فحص.
  const accountKey = username.trim().toLowerCase();
  try {
    const accountAllowed = await consumeLimit("login-account", accountKey, ACCOUNT_ATTEMPTS, WINDOW_SECONDS);
    const networkAllowed = await consumeLimit("login-network", clientIp(request), NETWORK_ATTEMPTS, WINDOW_SECONDS);
    if (!accountAllowed || !networkAllowed) return tooMany();
  } catch {
    // تعذّر الحجز يعني تعذّر الحماية — نغلق الباب بدل فتحه.
    return NextResponse.json({ error: "الدخول غير متاح مؤقتًا." }, { status: 503 });
  }

  const user = await findUser(username.trim());
  // كلمة المرور تُفحص دائمًا — ضد تجزئة وهمية عند غياب الحساب — فلا يفرق الزمن بين اسم موجود وآخر مختلق.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk) {
    await audit(user?.username ?? "anonymous", "login:failed", undefined, user ? "كلمة مرور غير صحيحة" : "حساب غير معروف");
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
  }
  // التعليق يُفحص بعد التحقق من كلمة المرور كي لا يكشف وجود الحساب لمن لا يملكها.
  if (user.status === "suspended") {
    await audit(user.username, "login:suspended");
    return NextResponse.json({ error: "عضويتك معلّقة — راجع مسؤول النظام." }, { status: 403 });
  }

  if (user.mfaSecret) {
    if (typeof code !== "string" || !code) return NextResponse.json({ error: "أدخل رمز تطبيق التحقق أو رمز استرداد.", mfaRequired: true }, { status: 401 });
    let verified = false;
    try {
      verified = code.length <= 64 && await verifyMfa(user, code.trim());
    } catch { return NextResponse.json({ error: "خدمة التحقق غير متاحة مؤقتًا." }, { status: 503 }); }
    if (!verified) {
      await audit(user.username, "login:failed", undefined, "رمز تحقق غير صحيح");
      return NextResponse.json({ error: "رمز التحقق غير صحيح أو استُخدم.", mfaRequired: true }, { status: 401 });
    }
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
    // الدخول الناجح يصفّر نافذة الحساب فقط؛ نافذة الشبكة تبقى ضد التخمين الموزّع على حسابات كثيرة.
    clearLimit("login-account", accountKey).catch(() => null),
  ]);

  const response = NextResponse.json({ ok: true, mustChangePassword: user.mustChangePassword === 1 });
  response.headers.set("Set-Cookie", sessionCookie(token));
  return response;
}
