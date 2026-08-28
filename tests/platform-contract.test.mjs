import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import test from "node:test";

const DIST = process.env.NEXT_DIST_DIR ?? ".next";
const htmlPath = new URL(`../${DIST}/server/app/index.html`, import.meta.url);
const routesPath = new URL(`../${DIST}/routes-manifest.json`, import.meta.url);
const ogPath = new URL("../public/og.png", import.meta.url);

test("renders Arabic RTL metadata with the approved knowledge positioning", async () => {
  const html = await readFile(htmlPath, "utf8");

  // وسم html يحمل أصناف next/font — نطابق البداية لا الوسم كاملًا.
  assert.match(html, /<html lang="ar" dir="rtl"/);
  assert.match(html, /property="og:locale" content="ar_SA"/);
  assert.match(html, /rel="canonical" href="https:\/\/alelm\.net"/);
  assert.match(html, /منصة إعلام ومعرفة سعودية/);
  assert.match(html, /"@type":"Organization"/);
  assert.doesNotMatch(html, /[\u0660-\u0669\u06F0-\u06F9]/, "الواجهة يجب أن تستخدم الأرقام اللاتينية فقط");
  assert.doesNotMatch(html, /name="keywords"/i);
  assert.doesNotMatch(html, /hagerh|allorigins|stage2?\.jakelelm/i);
});

test("deduplicates canonical story IDs across the entire homepage", async () => {
  const html = await readFile(htmlPath, "utf8");
  const ids = [...html.matchAll(/data-story-id="([^"]+)"/g)].map((match) => match[1]);

  assert.ok(ids.length >= 7, "expected hero and section stories");
  assert.equal(new Set(ids).size, ids.length, `duplicate IDs found: ${ids.join(", ")}`);
  assert.equal((html.match(/class="series-lens"/g) ?? []).length, 8, "بوابة السلاسل الثماني مفقودة");
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
  assert.doesNotMatch(headers["Content-Security-Policy"], /allorigins|stage2?\.jakelelm/i);
});

test("production CSP never leaks the development eval and websocket allowances", async () => {
  const routes = JSON.parse(await readFile(routesPath, "utf8"));
  const headers = Object.fromEntries(routes.headers[0].headers.map(({ key, value }) => [key, value]));
  const csp = headers["Content-Security-Policy"];

  // التطوير يحتاج unsafe-eval وws: لأجل React وHMR؛ الإنتاج يجب أن يبقى صارمًا.
  assert.doesNotMatch(csp, /unsafe-eval/, "unsafe-eval تسرّب إلى بناء الإنتاج");
  assert.match(csp, /connect-src 'self'(;|$)/, "connect-src يجب أن يكون 'self' وحده في الإنتاج");
});

test("keeps the M0 homepage and social card deliberately small", async () => {
  const html = await readFile(htmlPath);
  // العقد يقيس ما يعبر الشبكة فعلًا — كالميزانية المضغوطة لـJS (قرار المالك 2026-08-28).
  // الخام 109KB بعد تصميم «الطبعة التحريرية»، لكنه 17KiB مضغوطًا مقابل 601KB في الموقع القديم.
  const compressed = gzipSync(html, { level: 6 }).length;
  const png = await readFile(ogPath);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);

  assert.ok(compressed < 24 * 1024, `صفحة الرئيسية ${compressed} بايت مضغوطة والسقف 24KiB`);
  assert.deepEqual({ width, height }, { width: 1200, height: 630 });
});
