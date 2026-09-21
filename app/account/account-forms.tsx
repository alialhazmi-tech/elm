"use client";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { MEMBER_INTERESTS } from "@/lib/membership/interests";
import { refreshViewerAfter } from "@/lib/membership/client-session";
import {
  changeMemberPassword,
  saveAccountInterests,
  updateMemberDetails,
  type AccountFormState,
} from "./actions";

type Action = (
  state: AccountFormState,
  form: FormData,
) => Promise<AccountFormState>;
export function AccountAction({
  action,
  children,
  label,
  className = "ac-button ac-button-secondary",
  pendingLabel = "جارٍ الحفظ…",
}: {
  action: Action;
  children?: ReactNode;
  label: string;
  className?: string;
  pendingLabel?: string;
}) {
  const [state, submit, pending] = useActionState(
    (state: AccountFormState, form: FormData) => refreshViewerAfter(() => action(state, form)), {},
  );
  return (
    <form action={submit} className="ac-action-form">
      {children}
      <button type="submit" className={className} disabled={pending}>
        {pending && <LoaderCircle size={15} className="ac-spinner" />}
        {pending ? pendingLabel : label}
      </button>
      <FormFeedback state={state} />
    </form>
  );
}
export function FormFeedback({ state }: { state: AccountFormState }) {
  return (
    <>
      {state.error && (
        <p className="ac-feedback is-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="ac-feedback" role="status">
          <Check size={16} />
          {state.success}
        </p>
      )}
    </>
  );
}
export function DetailsForm({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(updateMemberDetails, {});
  useEffect(() => {
    if (state.success) window.dispatchEvent(new Event("alelm:profile-updated"));
  }, [state]);
  return (
    <>
      <form action={action} className="ac-edit-form ac-details-form">
        <label>
          الاسم
          <input
            name="name"
            autoComplete="name"
            minLength={2}
            maxLength={40}
            defaultValue={name}
            required
          />
        </label>
        <label>
          البريد الإلكتروني
          <input
            type="email"
            value={email}
            readOnly
            dir="ltr"
            aria-describedby="email-note"
          />
          <span className="ac-field-note" id="email-note">
            هذا بريد تسجيل الدخول. لا يمكن تغييره من هنا.
          </span>
        </label>
        <FormFeedback state={state} />
        <button className="ac-button ac-button-primary" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : "حفظ البيانات"}
        </button>
      </form>
    </>
  );
}
function SecretField({
  name,
  label,
  current = false,
}: {
  name: string;
  label: string;
  current?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label>
      {label}
      <span className="ac-secret">
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={current ? "current-password" : "new-password"}
          minLength={current ? undefined : 8}
          maxLength={128}
          required
          dir="ltr"
        />
        <button
          type="button"
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
export function PasswordForm() {
  const [state, action, pending] = useActionState(changeMemberPassword, {});
  return (
    <form action={action} className="ac-edit-form">
      <SecretField name="currentPassword" label="كلمة المرور الحالية" current />
      <SecretField name="newPassword" label="كلمة المرور الجديدة" />
      <SecretField name="confirmPassword" label="تأكيد كلمة المرور الجديدة" />
      <p className="ac-field-note">
        استخدم من 8 إلى 128 حرفًا. بعد التغيير، ستحتاج إلى تسجيل الدخول مجددًا على أجهزتك الأخرى.
      </p>
      <FormFeedback state={state} />
      <button className="ac-button ac-button-secondary" disabled={pending}>
        {pending ? "جارٍ تغيير كلمة المرور…" : "تغيير كلمة المرور"}
      </button>
    </form>
  );
}
export function InterestsForm({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState(initial);
  const [state, action, pending] = useActionState(saveAccountInterests, {});
  return (
    <form action={action}>
      <div className="ac-interest-options">
        {MEMBER_INTERESTS.map((item) => {
          const checked = selected.includes(item.id);
          return (
            <label
              key={item.id}
              className={checked ? "is-selected" : ""}
              style={{ "--interest-color": item.color } as React.CSSProperties}
            >
              <input
                name="interests"
                type="checkbox"
                value={item.id}
                checked={checked}
                onChange={() =>
                  setSelected((current) =>
                    checked
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id],
                  )
                }
              />
              <span className="ac-interest-symbol" aria-hidden="true">
                {checked ? <Check size={15} /> : <span />}
              </span>
              <span>
                <b>{item.label}</b>
                <small>{item.description}</small>
              </span>
            </label>
          );
        })}
      </div>
      <div className="ac-form-footer">
        <span>{selected.length} اهتمامات مختارة</span>
        <button className="ac-button ac-button-primary" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : "حفظ الاهتمامات"}
        </button>
      </div>
      <FormFeedback state={state} />
    </form>
  );
}
