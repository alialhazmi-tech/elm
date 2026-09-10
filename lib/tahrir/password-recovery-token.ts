import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const RECOVERY_TTL_MS = 15 * 60 * 1000;
export type RecoveryAccount = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  sessionVersion: number;
};
type RecoveryClaims = { purpose: "tahrir-password-recovery"; userId: string; version: number; state: string; expires: number };

export function recoveryAccountState(user: RecoveryAccount): string {
  return createHash("sha256").update(JSON.stringify([user.username, user.email, user.passwordHash])).digest("hex");
}
function signature(payload: string, secret: string) {
  // مفتاح منفصل سياقيًا: لا يصلح رمز الاستعادة بوصفه جلسة دخول.
  return createHmac("sha256", secret).update(`tahrir-password-recovery:${payload}`).digest();
}
export function createRecoveryToken(user: RecoveryAccount, secret: string, now = Date.now()): string {
  if (secret.length < 32) throw new Error("RECOVERY_SECRET_UNAVAILABLE");
  const claims: RecoveryClaims = { purpose: "tahrir-password-recovery", userId: user.id, version: user.sessionVersion, state: recoveryAccountState(user), expires: now + RECOVERY_TTL_MS };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}
export function readRecoveryToken(token: string, secret: string, now = Date.now()): RecoveryClaims | null {
  if (secret.length < 32 || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const expected = signature(parts[0], secret);
    const received = Buffer.from(parts[1], "base64url");
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) return null;
    const claims = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as RecoveryClaims;
    if (claims.purpose !== "tahrir-password-recovery" || typeof claims.userId !== "string" || !claims.userId || claims.userId.length > 190 || !Number.isSafeInteger(claims.version) || claims.version < 0 || !/^[a-f0-9]{64}$/.test(claims.state) || !Number.isSafeInteger(claims.expires) || claims.expires <= now || claims.expires > now + RECOVERY_TTL_MS) return null;
    return claims;
  } catch { return null; }
}
