/**
 * أصل الوسائط للعقد الجوّال — وحدة نقية بلا اعتماديات (تستوردها اختبارات node مباشرة).
 *
 * لماذا من الطلب لا من ثابت: `NEXT_PUBLIC_SITE_URL` يشير إلى alelm.net وهو موقع
 * ووردبريس القديم حتى تتم الهجرة، فكانت الصور المرفوعة على المنصة تُعلن تحت نطاق
 * لا يخدمها — ويفتح التطبيق ببطاقات بلا صور. الاشتقاق من الطلب يصح قبل القطع
 * وبعده بلا تغيير كود ولا متغير بيئة.
 */

export const FALLBACK_SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://alelm.net";

export function requestOrigin(request?: Request): string {
  if (!request) return FALLBACK_SITE;
  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return FALLBACK_SITE;
  const local = host.startsWith("localhost") || host.startsWith("127.");
  const proto = headers.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

/** الروابط الخارجية تمر كما هي (صور ووردبريس القديمة)، والمسارات تُبنى على الأصل. */
export function absoluteMedia(url: string | undefined, origin: string = FALLBACK_SITE): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${origin}${path}`;
}
