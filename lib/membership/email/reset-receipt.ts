import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type ResetReceipt = {
  email: string;
  name?: string;
  eventId: string;
  tokenHash: string;
  expiresAt: string;
};
function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function signature(payload: string, secret: string) {
  if (secret.length < 32) throw new Error("EMAIL_RECEIPT_SECRET_REQUIRED");
  return createHmac("sha256", secret)
    .update(`alelm-account-reset-v1.${payload}`)
    .digest();
}
// A signed receipt binds the notification recipient to the provider-issued token.
// It is not an authentication credential and never authorizes a password reset.
// Like the reset token, it must not be logged or included in outgoing referrers.
export function createResetReceipt(
  input: Omit<ResetReceipt, "tokenHash"> & { token: string },
  secret: string,
): string {
  const { token, ...rest } = input;
  const payload = Buffer.from(
    JSON.stringify({ ...rest, tokenHash: digest(token) }),
  ).toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}
export function readResetReceipt(
  receipt: string,
  token: string,
  secret: string,
  now = Date.now(),
): ResetReceipt | null {
  try {
    if (!receipt || receipt.length > 4096) return null;
    const parts = receipt.split(".");
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const actual = Buffer.from(sig, "base64url");
    const expected = signature(payload, secret);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const result = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as ResetReceipt;
    if (
      result.tokenHash !== digest(token) ||
      !Number.isFinite(Date.parse(result.expiresAt)) ||
      Date.parse(result.expiresAt) <= now
    )
      return null;
    if (typeof result.email !== "string" || typeof result.eventId !== "string")
      return null;
    return result;
  } catch {
    return null;
  }
}
