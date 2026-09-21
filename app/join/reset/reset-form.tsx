"use client";
import { useActionState } from "react";
import Link from "next/link";
import { resetMemberPassword, type AuthFormState } from "../actions";
import { PasswordInput } from "../join-form";
export function ResetForm({
  token,
  receipt = "",
  available,
}: {
  token: string;
  receipt?: string;
  available: boolean;
}) {
  const [state, action, pending] = useActionState(
    resetMemberPassword,
    {} as AuthFormState,
  );
  return (
    <div className="member-auth-card">
      <header className="member-form-head">
        <h2>كلمة مرور جديدة</h2>
        <p>اختر كلمة مرور آمنة لحسابك في العلم.</p>
      </header>
      {!available || !token ? (
        <p className="member-auth-error" role="alert">
          {!available
            ? "خدمة العضوية غير متاحة حاليًا."
            : "افتح رابط الاستعادة المرسل إلى بريدك."}
        </p>
      ) : state.success ? (
        <p className="member-auth-success" role="status">
          {state.success}
        </p>
      ) : (
        <form action={action} className="member-auth-form">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="receipt" value={receipt} />
          <PasswordInput
            autoComplete="new-password"
            label="كلمة المرور الجديدة"
          />
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            label="تأكيد كلمة المرور"
          />
          {state.error && (
            <p className="member-auth-error" role="alert">
              {state.error}
            </p>
          )}
          <button className="member-auth-submit" disabled={pending}>
            {pending ? "جارٍ الحفظ…" : "حفظ كلمة المرور"}
          </button>
        </form>
      )}
      <p className="member-auth-terms">
        <Link href="/join?mode=signin">العودة لتسجيل الدخول</Link>
      </p>
    </div>
  );
}
