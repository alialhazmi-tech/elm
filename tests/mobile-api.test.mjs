import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("عقد الرئيسية للموبايل يصدر بطاقات بلا متن وبصور مطلقة", async () => {
  const [mapper, route, docs] = await Promise.all([
    read("lib/mobile/home.ts"),
    read("app/api/mobile/v1/home/route.ts"),
    read("docs/ios/API_MOBILE_V1.md"),
  ]);

  assert.match(mapper, /mobile-home\.v1/);
  assert.match(mapper, /toMobileCard/);
  assert.match(mapper, /absoluteMedia/);
  assert.doesNotMatch(mapper, /body:\s*story/);
  assert.match(route, /X-Content-Contract/);
  assert.match(route, /PUBLIC_CONTENT_CACHE_CONTROL/);
  assert.match(route, /toMobileHome/);
  assert.match(docs, /GET \/api\/mobile\/v1\/home/);
});

test("عقد المادة والسلاسل للموبايل يحافظ على المسار المقدس", async () => {
  const [catalog, storyRoute, seriesRoute, feedRoute, docs] = await Promise.all([
    read("lib/mobile/catalog.ts"),
    read("app/api/mobile/v1/story/[id]/route.ts"),
    read("app/api/mobile/v1/series/route.ts"),
    read("app/api/mobile/v1/series/[slug]/route.ts"),
    read("docs/ios/API_MOBILE_V1.md"),
  ]);
  assert.match(catalog, /mobile-story\.v2/);
  assert.match(catalog, /mobile-series-index\.v1/);
  assert.match(catalog, /mobile-series-feed\.v1/);
  assert.match(catalog, /stripHtmlToText/);
  assert.match(catalog, /toMobileCard/);
  assert.match(storyRoute, /toMobileStory/);
  assert.match(seriesRoute, /toMobileSeriesIndex/);
  assert.match(feedRoute, /toMobileSeriesFeed/);
  assert.match(docs, /GET \/api\/mobile\/v1\/story\/:id/);
});

test("عقد البحث ولك للموبايل يطبّع العربية ويحمي الجلسة", async () => {
  const [catalog, searchRoute, forYouRoute, docs] = await Promise.all([
    read("lib/mobile/catalog.ts"),
    read("app/api/mobile/v1/search/route.ts"),
    read("app/api/mobile/v1/for-you/route.ts"),
    read("docs/ios/API_MOBILE_V1.md"),
  ]);
  assert.match(catalog, /mobile-search\.v1/);
  assert.match(catalog, /mobile-for-you\.v1/);
  assert.match(catalog, /foldSearchText/);
  assert.match(catalog, /normalizeArabic/);
  assert.match(searchRoute, /toMobileSearch/);
  assert.match(forYouRoute, /getSessionMemberId/);
  assert.match(forYouRoute, /private, no-store/);
  assert.match(forYouRoute, /401/);
  assert.match(docs, /GET \/api\/mobile\/v1\/search/);
  assert.match(docs, /GET \/api\/mobile\/v1\/for-you/);
});

test("حزمة الويب تبقى منفصلة عن عقد الموبايل", async () => {
  const web = await read("app/api/content/home/route.ts");
  assert.match(web, /home-bundle\.v2/);
  assert.doesNotMatch(web, /mobile-home/);
});

test("رابط الوسائط يُشتق من أصل الطلب لا من نطاق ثابت", async () => {
  const { absoluteMedia, requestOrigin } = await import("../lib/mobile/origin.ts");

  const railway = new Request("https://elm-production-5035.up.railway.app/api/mobile/v1/home", {
    headers: { host: "elm-production-5035.up.railway.app" },
  });
  assert.equal(requestOrigin(railway), "https://elm-production-5035.up.railway.app");
  assert.equal(
    absoluteMedia("/uploads/a.jpg", requestOrigin(railway)),
    "https://elm-production-5035.up.railway.app/uploads/a.jpg",
  );

  // خلف بروكسي: الترويسات المعاد توجيهها هي الحقيقة
  const proxied = new Request("http://internal/api", {
    headers: { host: "internal", "x-forwarded-host": "alelm.net", "x-forwarded-proto": "https" },
  });
  assert.equal(requestOrigin(proxied), "https://alelm.net");

  // محليًا http لا https
  const local = new Request("http://127.0.0.1:3000/api", { headers: { host: "127.0.0.1:3000" } });
  assert.equal(requestOrigin(local), "http://127.0.0.1:3000");

  // الروابط الخارجية تمر كما هي (صور ووردبريس القديمة)
  assert.equal(
    absoluteMedia("https://dash.alelm.net/wp-content/x.webp", "https://any"),
    "https://dash.alelm.net/wp-content/x.webp",
  );
});

test("عقد الموبايل يعيد أصولًا قابلة للخدمة عندما يكون التحسين معطلًا", async () => {
  const { optimizedMedia, MEDIA_WIDTH } = await import("../lib/mobile/origin.ts");
  const origin = "https://elm-production-5035.up.railway.app";

  // المحلية: نسبية داخل url= حتى تطابق localPatterns، بمقاس البطاقة الافتراضي
  assert.equal(
    optimizedMedia("/uploads/a.jpg", origin),
    `${origin}/uploads/a.jpg`,
  );

  // ووردبريس المسموحة في remotePatterns: تُغلّف كاملة بالمقاس المطلوب
  assert.equal(
    optimizedMedia("https://dash.alelm.net/wp-content/x.webp", origin, MEDIA_WIDTH.full),
    "https://dash.alelm.net/wp-content/x.webp",
  );

  // خارج القائمة المسموحة: يمرّ كما هو بدل رابط محسّن سيرد 400
  assert.equal(optimizedMedia("https://example.com/x.jpg", origin), "https://example.com/x.jpg");
  assert.equal(optimizedMedia(undefined, origin), null);

  // المقاسات ضمن deviceSizes/imageSizes في next.config.ts — خارجها يرفض المحسّن الطلب
  const config = await read("next.config.ts");
  for (const width of Object.values(MEDIA_WIDTH)) {
    assert.match(config, new RegExp(`deviceSizes: \\[[^\\]]*\\b${width}\\b`) , `العرض ${width} خارج deviceSizes`);
  }
  assert.match(config, /qualities: \[[^\]]*\b75\b/);
});

test("دوال العقد تعلن معامل الأصل صراحةً — لا تتكئ على متغير DOM العام", async () => {
  // فخ صامت: `origin` متغير عام في lib.dom فيرضيه TypeScript ويمر البناء،
  // ثم ينفجر ReferenceError في Node. الحارس على المصدر لا على النوع.
  const home = await readFile(new URL("../lib/mobile/home.ts", import.meta.url), "utf8");
  const catalog = await readFile(new URL("../lib/mobile/catalog.ts", import.meta.url), "utf8");

  for (const [name, source] of [["home.ts", home], ["catalog.ts", catalog]]) {
    for (const match of source.matchAll(/export (?:async )?function (\w+)\(([\s\S]*?)\)[:\s]/g)) {
      const [, fn, params] = match;
      const body = source.slice(match.index, source.indexOf("\n}", match.index));
      if (!/\borigin\b/.test(body)) continue;
      assert.match(
        params,
        /origin\??:\s*string/,
        `${name}: الدالة ${fn} تستخدم origin بلا إعلانه معاملًا`,
      );
    }
  }
});

test("عقد المادة v2 ينقل بيانات صفحات جاك وطابعها اللوني", async () => {
  const [catalog, docs] = await Promise.all([
    read("lib/mobile/catalog.ts"),
    read("docs/ios/API_MOBILE_V1.md"),
  ]);

  // صفحات المقارنة والمسار والقائمة والاقتباس بلا هذه الحقول تصل فارغة من مادتها.
  for (const field of ["eyebrow", "focal", "textSide", "sides", "points", "items", "quoteBy"]) {
    assert.match(catalog, new RegExp(`${field}:`), `الحقل ${field} مفقود من عقد الشريحة`);
  }

  // الطابع اللوني يصل مسطّحًا: التطبيق لا يعرف مفاتيح REPORT_PALETTES.
  assert.match(catalog, /MobileJakReport/);
  assert.match(catalog, /jakReportOf/);
  assert.match(catalog, /glow2/);
  assert.doesNotMatch(catalog, /REPORT_PALETTE_NAMES/);

  assert.match(docs, /mobile-story\.v2/);
  assert.match(docs, /"jak"/);
});
