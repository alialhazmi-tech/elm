import { contentSecurityPolicy } from "./lib/security/csp";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

import { LEGACY_REDIRECTS, LEGACY_STORY_REWRITES, LEGACY_QUERY_REWRITES } from "./lib/content/redirects";

/**
 * وضع التطوير يحتاج eval(): React وHMR وأدوات Next تستخدمه لإعادة بناء المكدسات
 * وتحديث الوحدات. بدونه يموت جافاسكربت الصفحة في المتصفح رغم أن التصيير الخادمي سليم.
 * الإنتاج يبقى صارمًا بلا unsafe-eval — ويحرسه اختبار في tests/platform-contract.
 */
const isDevelopment = process.env.NODE_ENV !== "production";
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy(isDevelopment) },
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
  // النشر يبطل كاش الخادم، لكن لا يصل إلى كاش التنقل في متصفح مفتوح.
  // أعد التحقق عند فتح الصفحة بدل استخدام نسخة prefetch لمدة خمس دقائق.
  experimental: { staleTimes: { dynamic: 0, static: 0 } },
  images: {
    // webp فقط: ترميز AVIF أبطأ بمرات على حاوية Railway المشتركة مع الـ API،
    // وwebp مقروء في التطبيق والمتصفحات كلها.
    formats: ["image/webp"],
    // أحجام محددة من مخزننا وأرشيف الوسائط فقط؛ لا نفتح محسّن Next لعناوين خاصة.
    loader: "custom",
    loaderFile: "./lib/image-variant-loader.ts",
    deviceSizes: [360, 640, 1080, 1600],
    imageSizes: [168],
    // إلزامي في Next 16 — بدونه يرفض المحسّن كل طلب (كما حدث في الإنتاج).
    qualities: [60, 75],
    // صور ووردبريس القديمة بلا Cache-Control؛ بدون حد أدنى يعاد جلبها كل دقيقة.
    minimumCacheTTL: 2678400,
    localPatterns: [{ pathname: "/uploads/**", search: "" }],
    dangerouslyAllowSVG: false,
    // أصل الوسائط الحالي؛ ينتقل إلى media.alelm.net على R2 ضمن M4.
    remotePatterns: [{ protocol: "https", hostname: "dash.alelm.net" }],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/tahrir/recover", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "private, no-store" }] },
      {
        // روابط iOS العالمية: آبل تشترط JSON صريحًا لملف الربط (بلا امتداد في public/).
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }, { key: "Cache-Control", value: "public, max-age=3600" }],
      },
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
    return [
      { source: "/:path*", has: [{ type: "host" as const, value: "www.alelm.net" }], destination: "https://alelm.net/:path*", permanent: true },
      ...LEGACY_REDIRECTS,
    ];
  },
  async rewrites() {
    // تُفحص قبل المسارات الديناميكية كي لا يُفسّر /74689 كاسم قسم.
    return { beforeFiles: LEGACY_QUERY_REWRITES, afterFiles: LEGACY_STORY_REWRITES, fallback: [] };
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
