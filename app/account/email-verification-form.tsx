"use client";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { FormFeedback } from "./account-forms";
import { sendMemberVerification, verifyMemberEmail, type AccountFormState } from "./actions";

export function EmailVerificationForm({ email }: { email: string }) {
  const [sent, send, sending] = useActionState(sendMemberVerification, {});
  const [verified, verify, verifying] = useActionState(
    async (state: AccountFormState, form: FormData) => {
      const result = await verifyMemberEmail(state, form);
      if (result.success)
        window.dispatchEvent(new Event("alelm:profile-updated"));
      return result;
    },
    {},
  );
  if (verified.success) return <FormFeedback state={verified} />;
  return (
    <section className="ac-verify" aria-label="إرسال رمز التوثيق وتأكيده">
      <div className="ac-verify-intro">
        <MailCheck size={28} aria-hidden="true" />
        <div>
          <h2>أكمل توثيق بريدك</h2>
          <p>أكمل توثيق حسابك برمز نرسله إلى بريدك الإلكتروني.</p>
          <bdi className="ac-verify-email" dir="ltr">
            {email}
          </bdi>
        </div>
      </div>
      <form action={send} className="ac-action-form">
        <button
          className="ac-button ac-button-primary"
          disabled={sending || verifying}
        >
          {sending
            ? "جارٍ الإرسال…"
            : sent.success
              ? "إعادة إرسال الرمز"
              : "إرسال رمز التحقق"}
        </button>
        <FormFeedback state={sent} />
      </form>
      <form action={verify} className="ac-edit-form ac-verify-code">
        <label>
          رمز التحقق
          <input
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            dir="ltr"
            required
          />
        </label>
        <button className="ac-button ac-button-primary" disabled={verifying || sending}>
          {verifying ? "جارٍ التحقق…" : "توثيق البريد"}
        </button>
        <FormFeedback state={verified} />
      </form>
    </section>
  );
}
