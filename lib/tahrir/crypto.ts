/**
 * نواة تشفير «تحرير العلم» — Web Crypto فقط (PBKDF2 + HMAC): تعمل على
 * Node وCloudflare Workers وسكربتات الزرع بلا أي اعتماديات أو next/*.
 */

export const SESSION_COOKIE = "alelm_tahrir";
export const SESSION_HOURS = 12;

/** معرّف الدور كما في جدول roles — الصلاحيات الفعلية تُحلّ من القاعدة في lib/tahrir/access.ts لا من الرمز. */
export type Role = string;

export interface Session {
  userId: string;
  username: string;
  displayName: string;
  role: Role;
  exp: number;
}

const encoder = new TextEncoder();

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string) =>
  new Uint8Array(hex.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? []);

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlDecode = (text: string) => {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = 120_000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await pbkdf2(password, salt, iterations);
  return `${toHex(salt)}:${iterations}:${toHex(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, iterationsText, expectedHex] = stored.split(":");
  if (!saltHex || !iterationsText || !expectedHex) return false;

  const derived = await pbkdf2(password, fromHex(saltHex), Number(iterationsText));
  const expected = fromHex(expectedHex);
  if (derived.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < derived.length; i += 1) diff |= derived[i] ^ expected[i];
  return diff === 0;
}

function authSecret(): string | null {
  return process.env.AUTH_SECRET ?? null;
}

async function hmac(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

export async function createSessionToken(
  session: Omit<Session, "exp">,
): Promise<string | null> {
  const secret = authSecret();
  if (!secret) return null;

  const payload = b64url(
    encoder.encode(
      JSON.stringify({ ...session, exp: Date.now() + SESSION_HOURS * 3_600_000 }),
    ),
  );
  return `${payload}.${b64url(await hmac(payload, secret))}`;
}

export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  const secret = authSecret();
  if (!secret || !token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = b64url(await hmac(payload, secret));
  if (expected.length !== signature.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  if (diff !== 0) return null;

  try {
    const session = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as Session;
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}


export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
