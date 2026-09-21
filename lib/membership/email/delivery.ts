import type { RenderedAccountEmail } from "./templates.ts";

export function accountEmailConfigured(): boolean {
  return (
    process.env.ACCOUNT_EMAIL_ENABLED === "true" &&
    Boolean(process.env.RESEND_API_KEY)
  );
}

export async function deliverAccountEmail(
  to: string,
  email: RenderedAccountEmail,
  idempotencyKey: string,
  transport: typeof fetch = fetch,
): Promise<void> {
  if (!accountEmailConfigured())
    throw new Error("ACCOUNT_EMAIL_NOT_CONFIGURED");
  if (to.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(to))
    throw new Error("INVALID_EMAIL_RECIPIENT");
  if (!/^[\w/-]{1,200}$/.test(idempotencyKey))
    throw new Error("INVALID_EMAIL_KEY");
  const response = await transport("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: "العلم <accounts@alelm.net>",
      to: [to],
      ...email,
    }),
    signal: AbortSignal.timeout(4000),
    cache: "no-store",
    redirect: "error",
  });
  // Never log response bodies: provider errors can contain recipients or tokens.
  if (!response.ok)
    throw new Error(`ACCOUNT_EMAIL_DELIVERY_${response.status}`);
}
