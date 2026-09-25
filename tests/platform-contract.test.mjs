import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import test from "node:test";
import sharp from "sharp";

const DIST = process.env.NEXT_DIST_DIR ?? ".next";
const htmlPath = new URL(`../${DIST}/server/app/index.html`, import.meta.url);
const routesPath = new URL(`../${DIST}/routes-manifest.json`, import.meta.url);
const ogPath = new URL(`../${DIST}/server/app/brand/share.jpg.body`, import.meta.url);

test("صفحات التنقل تعيد التحقق بدل الاحتفاظ بنسخة prefetch بعد النشر", async () => {
  const meta = JSON.parse(await readFile(new URL(`../${DIST}/server/app/index.meta`, import.meta.url), "utf8"));
  assert.equal(meta.headers["x-nextjs-stale-time"], "0");
});

test("places the approved GTM loader in head and its no-script fallback before authored body content", async () => {
  const html = await readFile(htmlPath, "utf8");
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";
  const loaders = [...head.matchAll(/<script id="google-tag-manager">([\s\S]*?)<\/script>/g)];
  assert.equal(loaders.length, 1);
  assert.match(loaders[0][1], /https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=/);
  assert.match(loaders[0][1], /'dataLayer','GTM-MLB68TX2'/);
  // Next.js may prepend its own empty Suspense boundary before authored body content.
  const body = html.slice(html.indexOf("<body")).replace('<div hidden=""><!--$--><!--/$--></div>', "");
  assert.match(body, /<body[^>]*><noscript><iframe[^>]*src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-MLB68TX2"[^>]*height="0"[^>]*width="0"[^>]*style="display:none;visibility:hidden"/);
  const routes = JSON.parse(await readFile(routesPath, "utf8"));
  const csp = routes.headers[0].headers.find(header => header.key === "Content-Security-Policy").value;
  for (const directive of ["script-src", "frame-src", "img-src", "connect-src"]) {
    const sources = csp.split("; ").find(value => value.startsWith(`${directive} `));
    assert.ok(sources?.split(" ").includes("https://www.googletagmanager.com"), `${directive} blocks GTM`);
  }
});

test("renders Arabic RTL metadata with the approved knowledge positioning", async () => {
  const html = await readFile(htmlPath, "utf8");

  // وسم html يحمل أصناف next/font — نطابق البداية لا الوسم كاملًا.
  assert.match(html, /<html lang="ar" dir="rtl"/);
  assert.match(html, /property="og:locale" content="ar_SA"/);
  assert.match(html, /rel="canonical" href="https:\/\/alelm\.net"/);
  assert.match(html, /منصة إعلام ومعرفة سعودية/);
  assert.match(html, /"@type":"NewsMediaOrganization"/);
  assert.match(html, /"@type":"WebSite"/);
  assert.match(html, /"@id":"https:\/\/alelm\.net\/#organization"/);
  assert.doesNotMatch(html, /[\u0660-\u0669\u06F0-\u06F9]/, "الواجهة يجب أن تستخدم الأرقام اللاتينية فقط");
  assert.doesNotMatch(html, /name="keywords"/i);
  assert.doesNotMatch(html, /hagerh|allorigins|stage2?\.jakelelm/i);
});

test("deduplicates canonical story IDs across the entire homepage", async () => {
  const html = await readFile(htmlPath, "utf8");
  const ids = [...html.matchAll(/data-story-id="([^"]+)"/g)].map((match) => match[1]);

  assert.ok(ids.length >= 7, "expected hero and section stories");
  assert.equal(new Set(ids).size, ids.length, `duplicate IDs found: ${ids.join(", ")}`);
  // «الناعم v2»: السلاسل التسع تظهر مرتين — مسطرة الهيدر وبلاطات القسم.
  assert.equal((html.match(/class="series-lens"/g) ?? []).length, 18, "بوابة السلاسل التسع مفقودة");
  assert.equal((html.match(/class="series-rail-inner"/g) ?? []).length, 1, "مسطرة السلاسل مفقودة من الهيدر");
});

test("الرئيسية لا تعرض بطاقة سؤال الأسبوع", async () => {
  const html = await readFile(htmlPath, "utf8");

  assert.doesNotMatch(html, /class="sh-why"/);
  assert.doesNotMatch(html, /سؤال الأسبوع/);
});

test("الخبر البارز والفاصلان يستخدمون ألوانًا محايدة", async () => {
  const [homeCss, headerCss, navigator] = await Promise.all([
    readFile(new URL("../app/home.css", import.meta.url), "utf8"),
    readFile(new URL("../app/header.css", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/series-navigator.tsx", import.meta.url), "utf8"),
  ]);
  const divider = navigator.slice(
    navigator.indexOf("export function SeriesSpectrum"),
    navigator.indexOf("export function SeriesRail"),
  );

  assert.match(homeCss, /\.sh-lead\s*\{[^}]*background:\s*var\(--surface-2\);[^}]*border:\s*1px solid var\(--line\);/s);
  assert.match(headerCss, /\.series-spectrum\s*\{[^}]*height:\s*1px;[^}]*background:\s*var\(--line\);/s);
  assert.doesNotMatch(divider, /item\.color|<i key=/);
});

test("عناوين الرئيسية تستخدم خط تفاصيل الخبر لا خط الشعار", async () => {
  const [homeCss, globalCss, articleCss] = await Promise.all([
    readFile(new URL("../app/home.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/soft.css", import.meta.url), "utf8"),
  ]);

  assert.match(globalCss, /--font-display:\s*var\(--f-display,\s*'Alexandria'\)/);
  assert.match(articleCss, /\.sa-head h1\s*\{[^}]*font-family:\s*var\(--font-display\)/s);
  assert.match(homeCss, /\.home-shell h1, \.home-shell h2, \.home-shell h3\s*\{[^}]*font-family:\s*var\(--font-display\)/s);
  assert.doesNotMatch(homeCss, /--font-display:\s*var\(--f-logo/);
});

test("emits the required M0 security headers without temporary domains", async () => {
  const routes = JSON.parse(await readFile(routesPath, "utf8"));
  const headers = Object.fromEntries(routes.headers[0].headers.map(({ key, value }) => [key, value]));

  for (const required of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ]) {
    assert.ok(headers[required], `${required} is missing`);
  }

  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  // مشغّل يوتيوب لمواد الفيديو — النسخة الخاصة بالخصوصية فقط.
  assert.match(headers["Content-Security-Policy"], /frame-src https:\/\/www\.youtube-nocookie\.com/);
  assert.doesNotMatch(headers["Content-Security-Policy"], /allorigins|stage2?\.jakelelm/i);
});

test("production CSP never leaks the development eval and websocket allowances", async () => {
  const routes = JSON.parse(await readFile(routesPath, "utf8"));
  const headers = Object.fromEntries(routes.headers[0].headers.map(({ key, value }) => [key, value]));
  const csp = headers["Content-Security-Policy"];

  // التطوير يحتاج unsafe-eval وws: لأجل React وHMR؛ الإنتاج يجب أن يبقى صارمًا.
  assert.doesNotMatch(csp, /unsafe-eval/, "unsafe-eval تسرّب إلى بناء الإنتاج");
  const connect = csp.split("; ").find(value => value.startsWith("connect-src "));
  assert.equal(connect, "connect-src 'self' https://www.googletagmanager.com https://www.google.com https://*.google-analytics.com https://*.analytics.google.com https://platform.twitter.com https://syndication.twitter.com https://cdn.syndication.twimg.com");
});

test("keeps the M0 homepage and social card deliberately small", async () => {
  const html = await readFile(htmlPath);
  // العقد يقيس ما يعبر الشبكة فعلًا — كالميزانية المضغوطة لـJS (قرار المالك 2026-08-28).
  // سقف 29KiB يشمل النص المقروء للنشرة الصوتية والسلسلة التاسعة وروابط التواصل وميتا المشاركة وكود GTM وسكيما الموقع وروابط تحميل الخطوط مبكرًا؛ يبقى قياسًا لحجم النقل المضغوط.
  const compressed = gzipSync(html, { level: 6 }).length;
  const { width, height, format, hasAlpha } = await sharp(await readFile(ogPath)).metadata();

  assert.ok(compressed < 29 * 1024, `صفحة الرئيسية ${compressed} بايت مضغوطة والسقف 29KiB`);
  assert.deepEqual({ width, height }, { width: 1200, height: 630 });
  assert.equal(format, "jpeg");
  assert.equal(hasAlpha, false);
});
