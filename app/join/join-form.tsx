"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import {
  requestMemberPasswordReset,
  signInMember,
  signUpMember,
  type AuthFormState,
} from "./actions";
const initialState: AuthFormState = {};

export function PasswordInput({
  name = "password",
  autoComplete,
  label = "كلمة المرور",
}: {
  name?: string;
  autoComplete: "new-password" | "current-password";
  label?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="member-field">
      <span>{label}</span>
      <span className="member-input-wrap">
        <LockKeyhole size={18} aria-hidden="true" />
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={autoComplete === "new-password" ? 8 : undefined}
          maxLength={128}
          required
          dir="ltr"
        />
        <button
          type="button"
          className="member-password-eye"
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}
function EmailInput() {
  return (
    <label className="member-field">
      <span>البريد الإلكتروني</span>
      <span className="member-input-wrap">
        <Mail size={18} aria-hidden="true" />
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={256}
          required
          dir="ltr"
          placeholder="name@example.com"
        />
      </span>
    </label>
  );
}
function Feedback({ state }: { state: AuthFormState }) {
  return (
    <>
      {state.error && (
        <p className="member-auth-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="member-auth-success" role="status">
          {state.success}
        </p>
      )}
    </>
  );
}
function SignUpForm({
  next,
  available,
}: {
  next?: string | null;
  available: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    signUpMember,
    initialState,
  );
  return (
    <form action={formAction} className="member-auth-form" id="signup-panel">
      {next && <input type="hidden" name="next" value={next} />}
      <fieldset disabled={!available || pending}>
        <label className="member-field">
          <span>اسمك</span>
          <span className="member-input-wrap">
            <UserRound size={18} aria-hidden="true" />
            <input
              name="name"
              autoComplete="name"
              maxLength={40}
              required
              placeholder="الاسم الذي تود أن نناديك به"
            />
          </span>
        </label>
        <EmailInput />
        <PasswordInput autoComplete="new-password" />
        <small className="member-password-hint">
          من 8 إلى 128 حرفًا. اختر كلمة مرور خاصة بحسابك.
        </small>
        <Feedback state={state} />
        <button className="member-auth-submit" type="submit">
          {pending ? "جارٍ إنشاء حسابك…" : "إنشاء حساب مجاني"}
          <ArrowLeft size={18} />
        </button>
      </fieldset>
    </form>
  );
}
function SignInForm({
  next,
  available,
  onForgot,
}: {
  next?: string | null;
  available: boolean;
  onForgot: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    signInMember,
    initialState,
  );
  return (
    <form action={formAction} className="member-auth-form" id="signin-panel">
      {next && <input type="hidden" name="next" value={next} />}
      <fieldset disabled={!available || pending}>
        <EmailInput />
        <PasswordInput autoComplete="current-password" />
        <button type="button" className="member-text-button" onClick={onForgot}>
          نسيت كلمة المرور؟
        </button>
        <Feedback state={state} />
        <button className="member-auth-submit" type="submit">
          {pending ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}
          <ArrowLeft size={18} />
        </button>
      </fieldset>
    </form>
  );
}
function ForgotForm({
  available,
  onBack,
}: {
  available: boolean;
  onBack: () => void;
}) {
  const [state, action, pending] = useActionState(
    requestMemberPasswordReset,
    initialState,
  );
  return (
    <form action={action} className="member-auth-form">
      <fieldset disabled={!available || pending}>
        <EmailInput />
        <Feedback state={state} />
        <button className="member-auth-submit" type="submit">
          {pending ? "جارٍ إرسال الطلب…" : "إرسال رابط الاستعادة"}
        </button>
      </fieldset>
      <button className="member-text-button" type="button" onClick={onBack}>
        العودة لتسجيل الدخول
      </button>
    </form>
  );
}
export function JoinForm({
  next,
  available = true,
  initialMode = "signup",
}: {
  next?: string | null;
  available?: boolean;
  initialMode?: "signup" | "signin";
}) {
  const [mode, setMode] = useState<"signup" | "signin" | "forgot">(initialMode);
  return (
    <div className="member-auth-card">
      <header className="member-form-head">
        <h2>
          {mode === "signup"
            ? "ابدأ فصلًا جديدًا"
            : mode === "signin"
              ? "أهلًا بعودتك"
              : "استعد حسابك"}
        </h2>
        <p>
          {mode === "signup"
            ? "دقيقة واحدة، وتصبح المعرفة أقرب إليك."
            : mode === "signin"
              ? "مكتبتك واهتماماتك بانتظارك."
              : "أدخل بريدك لنرسل لك رابط تغيير كلمة المرور."}
        </p>
      </header>
      {mode !== "forgot" && (
        <div className="member-auth-tabs" aria-label="طريقة الدخول">
          <button
            type="button"
            aria-pressed={mode === "signup"}
            onClick={() => setMode("signup")}
          >
            حساب جديد
          </button>
          <button
            type="button"
            aria-pressed={mode === "signin"}
            onClick={() => setMode("signin")}
          >
            لدي حساب
          </button>
        </div>
      )}
      {!available && (
        <div className="member-auth-unavailable" role="status">
          <strong>التسجيل والدخول غير متاحين حاليًا</strong>
          <span>
            يمكنك متابعة قراءة العلم، والعودة لإنشاء حسابك بعد تفعيل الخدمة.
          </span>
        </div>
      )}
      {mode === "signup" ? (
        <SignUpForm next={next} available={available} />
      ) : mode === "signin" ? (
        <SignInForm
          next={next}
          available={available}
          onForgot={() => setMode("forgot")}
        />
      ) : (
        <ForgotForm available={available} onBack={() => setMode("signin")} />
      )}
      <p className="member-auth-terms">
        نستخدم بيانات حسابك لتقديم خدمات العضوية وفق{" "}
        <Link href="/privacy-policy">سياسة الخصوصية</Link>.
      </p>
    </div>
  );
}
