/** RFC 6238؛ سر مستقل لكل عضو ورمز 30 ثانية، مع AES-GCM لحماية السر المخزّن. */
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes: Uint8Array) {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += alphabet[(value >>> (bits -= 5)) & 31]; } }
  if (bits) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
function decode32(secret: string) {
  let bits = 0, value = 0; const out: number[] = [];
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    const n = alphabet.indexOf(char); if (n < 0) throw new Error("Invalid TOTP key");
    value = (value << 5) | n; bits += 5; if (bits >= 8) out.push((value >>> (bits -= 8)) & 255);
  }
  return new Uint8Array(out);
}
export async function totp(secret: string, counter: number, digits = 6) {
  const key = await crypto.subtle.importKey("raw", decode32(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const buffer = new ArrayBuffer(8); new DataView(buffer).setBigUint64(0, BigInt(counter));
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, buffer));
  const offset = digest[digest.length - 1] & 15;
  const code = new DataView(digest.buffer).getUint32(offset) & 0x7fffffff;
  return String(code % (10 ** digits)).padStart(digits, "0");
}
export async function matchingCounter(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const counter = Math.floor(now / 30_000);
  for (const n of [counter, counter - 1, counter + 1]) if (await totp(secret, n) === code) return n;
  return null;
}
async function encryptionKey() {
  const value = process.env.TAHRIR_MFA_KEY;
  if (!value || !/^[a-f\d]{64}$/i.test(value)) throw new Error("MFA_KEY_UNAVAILABLE");
  const bytes = Uint8Array.from(value.match(/../g)!, pair => parseInt(pair, 16));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function sealMfa(value: string, purpose: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(purpose) }, await encryptionKey(), new TextEncoder().encode(value));
  return `${Buffer.from(iv).toString("base64url")}.${Buffer.from(cipher).toString("base64url")}`;
}
export async function openMfa(value: string, purpose: string) {
  const parts = value.split("."); if (parts.length !== 2) throw new Error("Invalid MFA envelope");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(parts[0], "base64url"), additionalData: new TextEncoder().encode(purpose) }, await encryptionKey(), Buffer.from(parts[1], "base64url"));
  return new TextDecoder().decode(plaintext);
}
export async function recoveryHash(userId: string, code: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${code.trim().toUpperCase()}`));
  return Buffer.from(digest).toString("hex");
}
/** مفتاح AES-GCM مضبوط بصيغته الصحيحة — بدونه لا تفعيل ولا إلزام. */
export function mfaConfigured(): boolean {
  return /^[a-f\d]{64}$/i.test(process.env.TAHRIR_MFA_KEY ?? "");
}
