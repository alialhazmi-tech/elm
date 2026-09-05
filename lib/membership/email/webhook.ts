import {
  createHash,
  createPublicKey,
  verify,
  type JsonWebKey,
} from "node:crypto";
import { createResetReceipt } from "./reset-receipt.ts";
import { EMAIL_ORIGIN, renderAccountEmail } from "./templates.ts";

type SigningKey = JsonWebKey & { kid?: string; alg?: string };
let cachedKeys: SigningKey[] = [];
let cachedBase = "";
let refreshedAt = 0;
let refresh: Promise<void> | undefined;
let keysUnavailable = false;

export async function verifyNeonEmailWebhook(
  body: string,
  headers: Headers,
  baseUrl: string,
  transport: typeof fetch = fetch,
  now = Date.now(),
): Promise<unknown> {
  const kid = headers.get("x-neon-signature-kid") ?? "";
  const timestamp = headers.get("x-neon-timestamp") ?? "";
  const signature = headers.get("x-neon-signature") ?? "";
  if (
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp)) > 300_000 ||
    !kid ||
    kid.length > 128 ||
    signature.length > 2048
  )
    throw new Error("INVALID_WEBHOOK_SIGNATURE");
  const parts = signature.split(".");
  if (
    parts.length !== 3 ||
    parts[1] !== "" ||
    !/^[\w-]+$/.test(parts[0]) ||
    !/^[\w-]+$/.test(parts[2])
  )
    throw new Error("INVALID_WEBHOOK_SIGNATURE");
  const protectedHeader = JSON.parse(
    Buffer.from(parts[0], "base64url").toString("utf8"),
  );
  if (
    protectedHeader.alg !== "EdDSA" ||
    protectedHeader.kid !== kid ||
    protectedHeader.crit ||
    protectedHeader.b64 === false
  )
    throw new Error("INVALID_WEBHOOK_SIGNATURE");
  const base = new URL(baseUrl);
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error("INVALID_AUTH_BASE");
  if (cachedBase !== base.href) {
    cachedKeys = [];
    refreshedAt = 0;
    cachedBase = base.href;
    keysUnavailable = false;
  }
  const known = cachedKeys.find((k) => k.kid === kid);
  // Refresh rotating keys, but throttle unknown-key requests to one per 10s.
  if ((!known || now - refreshedAt > 300_000) && now - refreshedAt > 10_000) {
    if (!refresh) {
      refreshedAt = now;
      refresh = (async () => {
        const response = await transport(
          `${base.href.replace(/\/$/, "")}/.well-known/jwks.json`,
          {
            signal: AbortSignal.timeout(2000),
            redirect: "error",
            cache: "no-store",
          },
        );
        if (!response.ok) throw new Error("WEBHOOK_KEYS_UNAVAILABLE");
        const jwks = await response.json();
        if (!Array.isArray(jwks.keys) || jwks.keys.length > 32)
          throw new Error("WEBHOOK_KEYS_UNAVAILABLE");
        cachedKeys = jwks.keys;
        keysUnavailable = false;
      })()
        .catch(() => {
          keysUnavailable = true;
          throw new Error("WEBHOOK_KEYS_UNAVAILABLE");
        })
        .finally(() => {
          refresh = undefined;
        });
    }
    await refresh;
  } else if (refresh) await refresh;
  const key = cachedKeys.find((k) => k.kid === kid);
  if (!key && keysUnavailable) throw new Error("WEBHOOK_KEYS_UNAVAILABLE");
  if (
    !key ||
    key.kty !== "OKP" ||
    key.crv !== "Ed25519" ||
    (key.alg && key.alg !== "EdDSA")
  )
    throw new Error("INVALID_WEBHOOK_SIGNATURE");
  const encoded = Buffer.from(
    `${timestamp}.${Buffer.from(body).toString("base64url")}`,
  ).toString("base64url");
  if (
    !verify(
      null,
      Buffer.from(`${parts[0]}.${encoded}`),
      createPublicKey({ key, format: "jwk" }),
      Buffer.from(parts[2], "base64url"),
    )
  )
    throw new Error("INVALID_WEBHOOK_SIGNATURE");
  return JSON.parse(body);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_EMAIL_EVENT");
  return value as Record<string, unknown>;
}
function string(value: unknown, max: number): string {
  if (typeof value !== "string" || !value || value.length > max)
    throw new Error("INVALID_EMAIL_EVENT");
  return value;
}
export function prepareNeonAccountEmail(
  payload: unknown,
  receiptSecret: string,
  now = Date.now(),
) {
  const event = object(payload),
    user = object(event.user),
    data = object(event.event_data);
  const eventId = string(event.event_id, 128);
  const to = string(user.email, 254);
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(to))
    throw new Error("INVALID_EMAIL_EVENT");
  const issuedAt = string(event.timestamp, 64),
    expiresAt = string(data.expires_at, 64);
  if (
    !Number.isFinite(Date.parse(issuedAt)) ||
    !Number.isFinite(Date.parse(expiresAt)) ||
    Date.parse(expiresAt) <= now ||
    Date.parse(issuedAt) > now + 60_000 ||
    now - Date.parse(issuedAt) > 300_000
  )
    throw new Error("EXPIRED_EMAIL_EVENT");
  const name =
    typeof user.name === "string" ? user.name.slice(0, 80) : undefined;
  const common = { name, issuedAt, expiresAt };
  let email;
  if (event.event_type === "send.otp") {
    if (data.delivery_preference && data.delivery_preference !== "email")
      throw new Error("UNSUPPORTED_EMAIL_EVENT");
    const kinds = {
      "email-verification": "verify-otp",
      "forget-password": "reset-otp",
      "sign-in": "signin-otp",
    } as const;
    const type = string(data.otp_type, 32);
    if (!Object.hasOwn(kinds, type)) throw new Error("UNSUPPORTED_EMAIL_EVENT");
    email = renderAccountEmail({
      ...common,
      kind: kinds[type as keyof typeof kinds],
      otp: string(data.otp_code, 6),
    });
  } else if (
    event.event_type === "send.magic_link" &&
    data.link_type === "forget-password"
  ) {
    const token = string(data.token, 2048);
    // Never forward the provider's link_url or an event-supplied callback domain.
    const url = new URL("/join/reset", EMAIL_ORIGIN);
    url.searchParams.set("token", token);
    url.searchParams.set(
      "receipt",
      createResetReceipt(
        { email: to, name, eventId, token, expiresAt },
        receiptSecret,
      ),
    );
    email = renderAccountEmail({
      ...common,
      kind: "reset-link",
      actionUrl: url.href,
    });
  } else {
    // Optional link sign-in/verification require their own tested callback flows.
    throw new Error("UNSUPPORTED_EMAIL_EVENT");
  }
  return {
    to,
    email,
    idempotencyKey: `neon-email/${createHash("sha256").update(eventId).digest("hex")}`,
  };
}
