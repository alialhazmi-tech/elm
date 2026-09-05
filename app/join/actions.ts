"use server";

import { redirect } from "next/navigation";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { getMemberProfile } from "@/lib/membership/profile";
import { safeInternalPath } from "@/lib/membership/paths";
import { readResetReceipt } from "@/lib/membership/email/reset-receipt";
import { notifyAccountChange } from "@/lib/membership/email/notifications";

export type AuthFormState = { error?: string; success?: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A development reset must return to the same local origin as its request.
// Production callbacks always use the canonical, provider-approved origin.
const appOrigin =
  process.env.NODE_ENV === "development" &&
  /^http:\/\/localhost:\d+$/.test(process.env.MEMBER_AUTH_APP_URL ?? "")
    ? process.env.MEMBER_AUTH_APP_URL!
    : "https://alelm.net";

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password: String(formData.get("password") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
  };
}

export async function signUpMember(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!memberAuthConfigured) return { error: "خدمة العضوية غير مهيأة حاليًا." };

  const { email, password, name } = credentials(formData);
  if (!name || name.length > 40)
    return { error: "أدخل اسمًا صحيحًا لا يتجاوز 40 حرفًا." };
  if (!emailPattern.test(email) || email.length > 256)
    return { error: "أدخل بريدًا إلكترونيًا صحيحًا." };
  if (password.length < 8 || password.length > 128)
    return { error: "كلمة المرور يجب أن تكون بين 8 و128 حرفًا." };

  try {
    const result = await memberAuth.signUp.email({ email, password, name });
    if (result.error)
      return {
        error:
          "تعذر إنشاء الحساب. قد يكون البريد مستخدمًا أو البيانات غير مكتملة.",
      };
  } catch {
    return { error: "تعذر الاتصال بخدمة العضوية. حاول مرة أخرى بعد قليل." };
  }

  redirect("/welcome");
}

export async function signInMember(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!memberAuthConfigured) return { error: "خدمة العضوية غير مهيأة حاليًا." };

  const { email, password } = credentials(formData);
  if (!emailPattern.test(email) || !password)
    return { error: "أدخل البريد وكلمة المرور." };

  let memberId = "";
  try {
    const result = await memberAuth.signIn.email({ email, password });
    if (result.error) return { error: "البريد أو كلمة المرور غير صحيحة." };
    memberId = result.data?.user?.id ?? "";
  } catch {
    return { error: "تعذر الاتصال بخدمة العضوية. حاول مرة أخرى بعد قليل." };
  }

  const profile = memberId ? await getMemberProfile(memberId) : null;
  const next = safeInternalPath(formData.get("next"));
  redirect(profile?.onboardingCompleted ? (next ?? "/account") : "/welcome");
}

export async function requestMemberPasswordReset(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!memberAuthConfigured) return { error: "خدمة العضوية غير متاحة حاليًا." };
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!emailPattern.test(email) || email.length > 256)
    return { error: "أدخل بريدًا إلكترونيًا صحيحًا." };
  try {
    const result = await memberAuth.requestPasswordReset({
      email,
      redirectTo: `${appOrigin}/join/reset`,
    });
    if (result.error)
      return { error: "تعذر إرسال طلب الاستعادة. حاول مرة أخرى بعد قليل." };
  } catch {
    return { error: "تعذر الاتصال بخدمة العضوية. حاول مرة أخرى." };
  }
  return {
    success:
      "إذا كان البريد مرتبطًا بحساب، فستصلك رسالة برابط استعادة كلمة المرور.",
  };
}

export async function resetMemberPassword(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!memberAuthConfigured) return { error: "خدمة العضوية غير متاحة حاليًا." };
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("password") ?? "");
  if (!token || token.length > 2048)
    return { error: "رابط الاستعادة غير صالح. اطلب رابطًا جديدًا." };
  if (newPassword.length < 8 || newPassword.length > 128)
    return { error: "كلمة المرور يجب أن تكون بين 8 و128 حرفًا." };
  if (newPassword !== formData.get("confirmPassword"))
    return { error: "كلمتا المرور غير متطابقتين." };
  const receipt = readResetReceipt(
    String(formData.get("receipt") ?? ""),
    token,
    process.env.ACCOUNT_EMAIL_RECEIPT_SECRET ?? "",
  );
  try {
    const result = await memberAuth.resetPassword({ token, newPassword });
    if (result.error)
      return {
        error:
          "انتهت صلاحية الرابط أو تعذر تغيير كلمة المرور. اطلب رابطًا جديدًا.",
      };
  } catch {
    return { error: "تعذر الاتصال بخدمة العضوية. حاول مرة أخرى." };
  }
  if (receipt)
    notifyAccountChange({
      kind: "password-changed",
      email: receipt.email,
      name: receipt.name,
      eventId: `reset/${receipt.eventId}`,
    });
  return { success: "تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن." };
}
