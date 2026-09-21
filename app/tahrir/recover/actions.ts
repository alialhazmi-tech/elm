"use server";

import { staffPasswordError } from "@/lib/tahrir/password-policy";

import { headers } from "next/headers";
import { after } from "next/server";
import { accountEmailConfigured, deliverAccountEmail } from "@/lib/membership/email/delivery";
import { renderAccountEmail, EMAIL_ORIGIN } from "@/lib/membership/email/templates";
import { consumeLimit } from "@/lib/tahrir/rate-limit";
import { findUser } from "@/lib/tahrir/service";
import { createRecoveryToken, RECOVERY_TTL_MS } from "@/lib/tahrir/password-recovery-token";
import { redeemStaffRecovery } from "@/lib/tahrir/password-recovery";

export type RecoveryState = { error?: string; success?: string };
const unavailable = { error: "استعادة كلمة المرور غير متاحة مؤقتًا. حاول لاحقًا أو تواصل مع مسؤول النظام." };

async function allowRecovery(scope: string, identity: string, limit: number) {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("cf-connecting-ip") || "unknown";
  const networkAllowed = await consumeLimit(`${scope}-network`, ip, 20, 900);
  const accountAllowed = await consumeLimit(`${scope}-account`, identity, limit, 900);
  return networkAllowed && accountAllowed;
}

/** مدخل عام لاسترداد الوصول؛ التفويض عند الاستهلاك برابط موقّع يُثبت ملكية البريد. */
export async function requestStaffPasswordReset(_state: RecoveryState, form: FormData): Promise<RecoveryState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  if (!username || username.length > 190) return { error: "أدخل اسم المستخدم أو بريد تسجيل الدخول." };
  if (!accountEmailConfigured() || (process.env.AUTH_SECRET?.length ?? 0) < 32) return unavailable;
  try {
    if (!await allowRecovery("staff-recovery-request", username, 3))
      return { error: "طلبات كثيرة. حاول بعد 15 دقيقة." };
  } catch { return unavailable; }

  // الاستعلام والإرسال بعد الرد؛ لا يكشف وقت الرد أو نصه وجود الحساب أو حالته.
  after(async () => {
    try {
      const user = await findUser(username);
      if (!user || user.status !== "active" || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(user.email)) return;
      const now = Date.now();
      const token = createRecoveryToken(user, process.env.AUTH_SECRET!, now);
      const email = renderAccountEmail({ kind: "staff-reset-link", name: user.displayName, actionUrl: `${EMAIL_ORIGIN}/tahrir/recover?token=${encodeURIComponent(token)}`, issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + RECOVERY_TTL_MS).toISOString() });
      const key = `staff-recovery/${crypto.randomUUID()}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { await deliverAccountEmail(user.email, email, key); return; }
        catch { if (attempt === 1) console.error("STAFF_RECOVERY_DELIVERY_FAILED"); }
      }
    } catch { console.error("STAFF_RECOVERY_REQUEST_FAILED"); }
  });
  return { success: "إذا كان الحساب نشطًا وله بريد مسجّل، فستصلك رسالة برابط استعادة كلمة المرور. تحقّق من الوارد والرسائل غير المرغوب فيها." };
}

export async function completeStaffPasswordReset(_state: RecoveryState, form: FormData): Promise<RecoveryState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (!token || token.length > 2048) return { error: "رابط الاستعادة غير صالح. اطلب رابطًا جديدًا." };
  const passwordError = staffPasswordError(password);
  if (passwordError) return { error: passwordError };
  if (password !== form.get("confirmPassword")) return { error: "كلمتا المرور غير متطابقتين." };
  try {
    if (!await allowRecovery("staff-recovery-redeem", token, 10)) return { error: "محاولات كثيرة. حاول بعد 15 دقيقة أو اطلب رابطًا جديدًا." };
    if (!await redeemStaffRecovery(token, password)) return { error: "رابط الاستعادة منتهي أو مستخدم أو غير صالح. اطلب رابطًا جديدًا." };
  } catch { return unavailable; }
  return { success: "تم تغيير كلمة المرور وإنهاء الجلسات السابقة. سجّل الدخول بكلمتك الجديدة، ورمز التحقق الثنائي إن كان مفعّلًا." };
}
