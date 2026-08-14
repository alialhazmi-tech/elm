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

/**
 * مقاسات العقد الجوّال — من deviceSizes/imageSizes في next.config.ts حصرًا،
 * فالمحسّن يرفض أي عرض خارجها بـ 400.
 */
export const MEDIA_WIDTH = {
  /** بطاقات القوائم والمصغّرات. */
  card: 640,
  /** الصدارة وصفحة المادة وشرائح تقارير جاك — ملء عرض الشاشة على 3x. */
  full: 1080,
} as const;

/**
 * رابط عبر محسّن صور Next بدل الأصل الكامل: أصل `/uploads` كان يمرّ من S3
 * بـ 0.7–1MB للصورة، والمحسّن يصغّرها إلى webp بعشرات الكيلوبايتات ويكيّشها.
 * الروابط المحلية تُمرَّر نسبية (localPatterns)، والخارجية كاملة (remotePatterns).
 */
export function optimizedMedia(
  url: string | undefined,
  origin: string = FALLBACK_SITE,
  width: number = MEDIA_WIDTH.card,
): string | null {
  if (!url) return null;
  const external = /^https?:\/\//i.test(url);
  if (external && !url.startsWith("https://dash.alelm.net/wp-content/")) {
    // خارج قائمة remotePatterns المسموحة — يمرّ كما هو بدل رابط محسّن سيرد 400.
    return url;
  }
  const target = external ? url : url.startsWith("/") ? url : `/${url}`;
  return `${origin}/_next/image?url=${encodeURIComponent(target)}&w=${width}&q=75`;
}
