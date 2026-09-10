"use client";
import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memberSessionStore } from "@/lib/membership/client-session";
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
  invalid,
  describedBy,
}: {
  name?: string;
  autoComplete: "new-password" | "current-password";
  label?: string;
  invalid?: boolean;
  describedBy?: string;
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
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="member-password-eye"
          aria-label={`${visible ? "إخفاء" : "إظهار"} ${label}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <Eye size={18} /> : <EyeOff size={18} />}
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
  const [confirmation, setConfirmation] = useState({ passwordLength: 0, hasValue: false, mismatched: false });
  const passwordValid = confirmation.passwordLength >= 8 && confirmation.passwordLength <= 128;
  function readConfirmation(form: HTMLFormElement) {
    const data = new FormData(form);
    return { passwordLength: String(data.get("password") ?? "").length, hasValue: Boolean(data.get("confirmPassword")), mismatched: data.get("password") !== data.get("confirmPassword") };
  }
  return (
    <form
      action={formAction}
      className="member-auth-form"
      id="signup-panel"
      onInput={(event) => setConfirmation(readConfirmation(event.currentTarget))}
      onReset={() => setConfirmation({ passwordLength: 0, hasValue: false, mismatched: false })}
      onSubmit={(event) => {
        // افحص القيم الفعلية أيضًا: بعض أدوات الملء التلقائي لا تطلق حدث input.
        const current = readConfirmation(event.currentTarget);
        setConfirmation(current);
        const invalidPassword = current.passwordLength < 8 || current.passwordLength > 128;
        if (current.mismatched || invalidPassword) {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem(invalidPassword ? "password" : "confirmPassword");
          if (input instanceof HTMLInputElement) input.focus();
        }
      }}
    >
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
        <div className="member-password-validation">
          <PasswordInput autoComplete="new-password" invalid={confirmation.passwordLength > 0 && !passwordValid} describedBy="signup-password-requirements" />
          <p id="signup-password-requirements" aria-live="polite" aria-atomic="true" className={`member-password-feedback${confirmation.passwordLength > 0 ? passwordValid ? " member-auth-success" : " member-auth-error" : ""}`}>
            {confirmation.passwordLength === 0 ? "أدخل من 8 إلى 128 محرفًا." : passwordValid ? "كلمة المرور تستوفي شرط الطول: من 8 إلى 128 محرفًا." : confirmation.passwordLength < 8 ? "كلمة المرور قصيرة؛ أدخل 8 محارف على الأقل." : "كلمة المرور طويلة؛ لا تتجاوز 128 محرفًا."}
          </p>
        </div>
        <small className="member-password-hint">
          يُنصح بكلمة طويلة وفريدة تجمع حروفًا وأرقامًا ورموزًا مثل ! أو @ لزيادة قوتها.
        </small>
        <div className="member-password-validation">
          <PasswordInput name="confirmPassword" autoComplete="new-password" label="تأكيد كلمة المرور" invalid={confirmation.hasValue && confirmation.mismatched} describedBy="signup-password-confirmation" />
          <p id="signup-password-confirmation" aria-live="polite" aria-atomic="true" className={`member-password-feedback${confirmation.hasValue ? confirmation.mismatched ? " member-auth-error" : " member-auth-success" : ""}`}>
            {confirmation.hasValue ? confirmation.mismatched ? "كلمتا المرور غير متطابقتين." : "كلمتا المرور متطابقتان." : "أعد كتابة كلمة المرور نفسها للتأكيد."}
          </p>
        </div>
        <Feedback state={state} />
        <button className="member-auth-submit" type="submit" disabled={confirmation.mismatched || (confirmation.passwordLength > 0 && !passwordValid) || pending}>
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
  initialMode?: "signup" | "signin" | "forgot";
}) {
  const [mode, setMode] = useState<"signup" | "signin" | "forgot">(initialMode);
  const router = useRouter();
  const authenticated = useSyncExternalStore(memberSessionStore.subscribe, memberSessionStore.getSnapshot, memberSessionStore.getServerSnapshot);
  useEffect(() => {
    // يعيد تشغيل حارس /join الخادمي بعد اكتشاف الهيدر جلسة أحدث من الصفحة.
    if (authenticated) router.refresh();
  }, [authenticated, router]);
  if (authenticated) {
    const href = next ? `/join?next=${encodeURIComponent(next)}` : "/join";
    return <div className="member-auth-card"><p role="status">أنت مسجّل الدخول. جارٍ الانتقال إلى حسابك…</p><a className="member-text-button" href={href}>المتابعة إلى حسابك</a></div>;
  }
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
