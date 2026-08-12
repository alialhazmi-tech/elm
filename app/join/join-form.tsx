"use client";

import { useActionState, useState } from "react";
import { signInMember, signUpMember, type AuthFormState } from "./actions";

const initialState: AuthFormState = {};

function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpMember, initialState);

  return (
    <form action={formAction} className="member-auth-form" id="signup-panel">
      <label>
        <span>الاسم الأول</span>
        <input name="name" autoComplete="given-name" maxLength={40} required placeholder="كيف نناديك؟" />
      </label>
      <label>
        <span>البريد الإلكتروني</span>
        <input name="email" type="email" inputMode="email" autoComplete="email" maxLength={256} required dir="ltr" placeholder="name@example.com" />
      </label>
      <label>
        <span>كلمة المرور</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required dir="ltr" />
        <small>8 أحرف على الأقل. استخدم عبارة طويلة لا تستعملها في موقع آخر.</small>
      </label>

      {state.error && <p className="member-auth-error" role="alert">{state.error}</p>}
      <button className="member-auth-submit" disabled={pending}>
        {pending ? "لحظة…" : "إنشاء حسابي"}
      </button>
    </form>
  );
}

function SignInForm() {
  const [state, formAction, pending] = useActionState(signInMember, initialState);

  return (
    <form action={formAction} className="member-auth-form" id="signin-panel">
      <label>
        <span>البريد الإلكتروني</span>
        <input name="email" type="email" inputMode="email" autoComplete="email" maxLength={256} required dir="ltr" placeholder="name@example.com" />
      </label>
      <label>
        <span>كلمة المرور</span>
        <input name="password" type="password" autoComplete="current-password" maxLength={128} required dir="ltr" />
      </label>

      {state.error && <p className="member-auth-error" role="alert">{state.error}</p>}
      <button className="member-auth-submit" disabled={pending}>
        {pending ? "لحظة…" : "تسجيل الدخول"}
      </button>
    </form>
  );
}

export function JoinForm() {
  const [mode, setMode] = useState<"signup" | "signin">("signup");

  return (
    <div className="member-auth-card">
      <div className="member-auth-tabs" role="tablist" aria-label="الدخول إلى العلم">
        <button type="button" role="tab" aria-selected={mode === "signup"} aria-controls="signup-panel" onClick={() => setMode("signup")}>حساب جديد</button>
        <button type="button" role="tab" aria-selected={mode === "signin"} aria-controls="signin-panel" onClick={() => setMode("signin")}>لدي حساب</button>
      </div>

      {mode === "signup" ? <SignUpForm /> : <SignInForm />}
      <p className="member-auth-terms">بإنشاء الحساب أنت توافق على شروط الاستخدام وسياسة الخصوصية. عضوية الجمهور مستقلة عن حسابات المحررين.</p>
    </div>
  );
}
