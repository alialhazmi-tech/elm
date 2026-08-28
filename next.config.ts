import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

import { LEGACY_REDIRECTS } from "./lib/content/redirects";

/**
 * وضع التطوير يحتاج eval(): React وHMR وأدوات Next تستخدمه لإعادة بناء المكدسات
 * وتحديث الوحدات. بدونه يموت جافاسكربت الصفحة في المتصفح رغم أن التصيير الخادمي سليم.
 * الإنتاج يبقى صارمًا بلا unsafe-eval — ويحرسه اختبار في tests/platform-contract.
 */
const isDevelopment = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "object-src 'none'",
  isDevelopment ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  isDevelopment ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
  // ترقية HTTP منطقية في الإنتاج فقط؛ في التطوير تحوّل أصول localhost إلى HTTPS
  // وتمنع المعاينة على الأجهزة والشاشات الأخرى في الشبكة المحلية.
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // بوابة الجودة تبني في مجلد منفصل حتى لا تستبدل أصول خادم التطوير أثناء عمله.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  compress: true,
  images: {
    // webp فقط: ترميز AVIF أبطأ بمرات على حاوية Railway المشتركة مع الـ API،
    // وwebp مقروء في التطبيق والمتصفحات كلها.
    formats: ["image/webp"],
    deviceSizes: [360, 640, 768, 1080, 1280, 1920],
    imageSizes: [320, 480, 640],
    // إلزامي في Next 16 — بدونه يرفض المحسّن كل طلب (كما حدث في الإنتاج).
    qualities: [60, 75],
    // صور ووردبريس القديمة بلا Cache-Control؛ بدون حد أدنى يعاد جلبها كل دقيقة.
    minimumCacheTTL: 2678400,
    localPatterns: [{ pathname: "/uploads/**", search: "" }],
    dangerouslyAllowSVG: false,
    // أصل الوسائط الحالي؛ ينتقل إلى media.alelm.net على R2 ضمن M4.
    remotePatterns: [{ protocol: "https", hostname: "dash.alelm.net", pathname: "/wp-content/**" }],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // قبل قطع النطاق: أصل Railway لا يدخل فهرس قوقل حتى لا ينافس alelm.net القديم.
        // canonical المطلق إلى alelm.net قائم أيضًا، وهذه الترويسة تحسم الازدواج نهائيًا.
        source: "/:path*",
        has: [{ type: "host", value: ".*\\.up\\.railway\\.app" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async redirects() {
    // طبقة 301 للروابط القديمة (وسوم السلاسل و«غير مصنف») — تفاصيلها في lib/content/redirects.
    return LEGACY_REDIRECTS;
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
