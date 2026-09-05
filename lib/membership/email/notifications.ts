import { createHash, randomUUID } from "node:crypto";
import { after } from "next/server";
import { accountEmailConfigured, deliverAccountEmail } from "./delivery";
import { renderAccountEmail } from "./templates";

/** Called only after a successful server-side auth operation, with server-owned identity. */
export function notifyAccountChange(input: {
  kind: "welcome" | "password-changed";
  email: string;
  name?: string;
  eventId?: string;
  changedAt?: string;
}) {
  if (!accountEmailConfigured()) return;
  const email = renderAccountEmail({
    ...input,
    changedAt: input.changedAt ?? new Date().toISOString(),
  });
  const key = `account-${input.kind}/${createHash("sha256")
    .update(input.eventId ?? randomUUID())
    .digest("hex")}`;
  after(async () => {
    // Notifications must never make a completed password change look unsuccessful.
    // Two attempts share an identical payload and provider idempotency key.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await deliverAccountEmail(input.email, email, key);
        return;
      } catch {
        /* Retry without exposing the recipient or provider response. */
      }
    }
    console.error(`ACCOUNT_EMAIL_NOTIFICATION_FAILED:${input.kind}`);
  });
}
