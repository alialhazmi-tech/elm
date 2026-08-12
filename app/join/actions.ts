"use server";

import { redirect } from "next/navigation";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";

export type AuthFormState = { error?: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
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
  if (!name || name.length > 40) return { error: "أدخل اسمًا صحيحًا لا يتجاوز 40 حرفًا." };
  if (!emailPattern.test(email) || email.length > 256) return { error: "أدخل بريدًا إلكترونيًا صحيحًا." };
  if (password.length < 8 || password.length > 128) return { error: "كلمة المرور يجب أن تكون بين 8 و128 حرفًا." };

  try {
    const result = await memberAuth.signUp.email({ email, password, name });
    if (result.error) return { error: "تعذر إنشاء الحساب. قد يكون البريد مستخدمًا أو البيانات غير مكتملة." };
  } catch {
    return { error: "تعذر الاتصال بخدمة العضوية. حاول مرة أخرى بعد قليل." };
  }

  redirect("/account?welcome=1");
}

export async function signInMember(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!memberAuthConfigured) return { error: "خدمة العضوية غير مهيأة حاليًا." };

  const { email, password } = credentials(formData);
  if (!emailPattern.test(email) || !password) return { error: "أدخل البريد وكلمة المرور." };

  try {
    const result = await memberAuth.signIn.email({ email, password });
    if (result.error) return { error: "البريد أو كلمة المرور غير صحيحة." };
  } catch {
    return { error: "تعذر الاتصال بخدمة العضوية. حاول مرة أخرى بعد قليل." };
  }

  redirect("/account");
}
