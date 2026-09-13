import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const ORIGIN_TOKEN_HEADER = "x-alelm-origin-token";
type OriginConfig = { enforced: boolean; secret?: string; cronSecret?: string };
function matches(actual: string | null, expected?: string) {
  if (!actual || !expected || actual.length > 512) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
/** لا نثق بـHost أو X-Forwarded-For أو اسم localhost لإثبات المرور عبر الحافة. */
export function originAccess(request: { url: string; method: string; headers: Headers }, config: OriginConfig) {
  if (!config.enforced) return { allowed: true, status: 200, clientIp: null };
  if (!config.secret || config.secret.length < 32 || config.secret.length > 512) return { allowed: false, status: 503, clientIp: null };
  const path = new URL(request.url).pathname;
  // استثناء جاهزية ضيق؛ لا يعرض محتوى أو هوية ولا يمنح الوصول إلى أي مسار آخر.
  if (path === "/api/health" && (request.method === "GET" || request.method === "HEAD")) return { allowed: true, status: 200, clientIp: null };
  // المجدول المحلي والعامل الخارجي يثبتان هويتهما بسر مستقل؛ لا استثناء اعتمادًا على المضيف.
  if (path === "/api/tahrir/tick" && request.method === "POST" && matches(request.headers.get("authorization"), config.cronSecret ? `Bearer ${config.cronSecret}` : undefined)) {
    return { allowed: true, status: 200, clientIp: null };
  }
  if (!matches(request.headers.get(ORIGIN_TOKEN_HEADER), config.secret)) return { allowed: false, status: 403, clientIp: null };
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  // Cloudflare يكتب هذا الرأس بنفسه، ويُقبل فقط بعد توثيق المسار بالسر.
  if (!isIP(ip)) return { allowed: false, status: 403, clientIp: null };
  return { allowed: true, status: 200, clientIp: ip };
}
