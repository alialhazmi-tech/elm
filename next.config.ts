import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

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
  "upgrade-insecure-requests",
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
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 640, 768, 1024, 1280, 1920],
    imageSizes: [320, 480, 640],
    dangerouslyAllowSVG: false,
    // أصل الوسائط الحالي؛ ينتقل إلى media.alelm.net على R2 ضمن M4.
    remotePatterns: [{ protocol: "https", hostname: "dash.alelm.net", pathname: "/wp-content/**" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
