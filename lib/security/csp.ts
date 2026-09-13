import { createHash } from "node:crypto";
import { themeInit, tagManagerInit } from "./browser-scripts.ts";
const bootstrapHashes = [themeInit, tagManagerInit].map(script => "'sha256-" + createHash("sha256").update(script).digest("base64") + "'").join(" ");

/** nonce للتحرير الديناميكي فقط؛ الصفحات العامة تحتفظ بـISR. */
export function contentSecurityPolicy(isDevelopment: boolean, nonce?: string) {
// نطاقات الحاوية وقياس Google Analytics؛ لا نفتح الاتصال لكل المصادر الخارجية.
const googleConnectSources = "https://www.googletagmanager.com https://www.google.com https://*.google-analytics.com https://*.analytics.google.com";

return [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // مشغّلات يوتيوب وInstagram وتضمين X الرسمي وإطار GTM البديل عند تعطيل JavaScript.
  "frame-src https://www.youtube-nocookie.com https://www.googletagmanager.com https://platform.twitter.com https://syndication.twitter.com https://twitter.com/i/videos/tweet/ https://x.com/i/videos/tweet/ https://www.instagram.com",
  "img-src 'self' data: blob: https://dash.alelm.net https://www.googletagmanager.com https://*.google-analytics.com",
  // بث حلقات البودكاست: مضيفو الخلاصات يحوّلون الملفات عبر CDN متغير النطاقات،
  // والمنقّي يجرد أي وسم وسائط من المتون — مكوناتنا وحدها مصدر <audio>.
  "media-src 'self' blob: https:",
  "object-src 'none'",
  `script-src 'self' ${nonce ? `'nonce-${nonce}' ${bootstrapHashes}` : "'unsafe-inline'"} https://www.googletagmanager.com https://platform.twitter.com https://syndication.twitter.com https://cdn.syndication.twimg.com${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${googleConnectSources} https://platform.twitter.com https://syndication.twitter.com https://cdn.syndication.twimg.com${isDevelopment ? " ws: wss:" : ""}`,
  // ترقية HTTP منطقية في الإنتاج فقط؛ في التطوير تحوّل أصول localhost إلى HTTPS
  // وتمنع المعاينة على الأجهزة والشاشات الأخرى في الشبكة المحلية.
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

}
