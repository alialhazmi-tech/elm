import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { stories } from "../db/schema.ts";

import { LEGACY_REDIRECTS, LEGACY_SECTION_SLUGS, LEGACY_STORY_REWRITES, TAG_TO_SERIES } from "../lib/content/redirects.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/* عقود M-2: حارس canonical، خرائط الموقع الكاملة، طبقة 301 — شروط بقاء الأرشيف. */

test("طبقة التحويلات تغطي وسوم السلاسل الثلاث عشرة كلها وبتحويل دائم", () => {
  const targets = new Set(Object.values(TAG_TO_SERIES));
  const expected = [
    "absat", "aghrab", "efhamha-sah", "bel-arqam", "shakhsiat", "limatha",
    "matha-law", "bel-tarikh", "qalu", "taqarir", "muwaththaq", "matha-baad", "elm-mondial",
  ];
  for (const slug of expected) {
    assert.ok(targets.has(slug), `وسم السلسلة ${slug} بلا تحويل`);
  }
  for (const rule of LEGACY_REDIRECTS) {
    assert.equal(rule.permanent, true, `تحويل غير دائم: ${rule.source}`);
    assert.ok(rule.source.startsWith("/"), `مصدر غير مطلق: ${rule.source}`);
    // الوجهة داخلية دائمًا، عدا أرشيف الوسائط الباقي على مضيف ووردبريس القديم.
    assert.ok(
      rule.destination.startsWith("/") || rule.destination.startsWith("https://dash.alelm.net/"),
      `وجهة غير مطلقة: ${rule.destination}`,
    );
  }
  // «غير مصنف» بنسختيه يقاس على منوعات.
  assert.ok(LEGACY_REDIRECTS.some((rule) => rule.source === "/uncategorized" && rule.destination === "/varieties"));
  assert.ok(LEGACY_REDIRECTS.some((rule) => rule.source === "/غير-مصنف" && rule.destination === "/varieties"));
});

test("مسار المقال يفرض canonical بالمعرّف: تحويل دائم لأي قسم أو سلاج مخالف", async () => {
  const page = await read("app/[section]/[id]/[slug]/page.tsx");
  assert.match(page, /permanentRedirect\(encodeURI\(storyHref\(story\)\)\)/u, "لا يوجد تحويل دائم مرمّز للرابط المحفوظ");
  assert.match(page, /safeDecode\(section\) !== story\.section/u, "لا فحص للقسم المطلوب");
  assert.match(page, /safeDecode\(slug\) !== story\.slug/u, "لا فحص للسلاج المطلوب");
  assert.match(page, /alternates: \{ canonical: storyHref\(story\) \}/u, "canonical لا يُبنى من الرابط المحفوظ");
  assert.match(page, /listRecent\(\d+\)/u, "البناء المسبق بلا سقف — سينفجر بناء 29 ألف صفحة");
});

test("خريطة الموقع تضم كل المواد المنشورة وتُحدَّث دوريًا", async () => {
  const sitemap = await read("app/sitemap.ts");
  assert.match(sitemap, /listSitemapEntries/u, "الخريطة لا تستعلم المواد");
  assert.match(sitemap, /story\.section.*publicStoryId\(story\).*encodeURIComponent\(story\.slug\)/su, "روابط المواد لا تحفظ الثلاثية");
  assert.match(sitemap, /export const revalidate/u, "الخريطة بلا إعادة توليد");
});

test("خريطة أخبار Google News موجودة ومسجلة في robots", async () => {
  const [news, robots] = await Promise.all([
    read("app/sitemap-news.xml/route.ts"),
    read("app/robots.ts"),
  ]);
  assert.match(news, /news:publication_date/u);
  assert.match(news, /<news:name>العلم<\/news:name>/u);
  assert.match(news, /48 \* 60 \* 60 \* 1000/u, "نافذة الأخبار ليست 48 ساعة");
  assert.match(robots, /sitemap-news\.xml/u, "robots لا يعلن خريطة الأخبار");
});

test("إعداد Next يفعّل طبقة التحويلات ويمنع فهرسة أصل Railway قبل القطع", async () => {
  const config = await read("next.config.ts");
  assert.match(config, /async redirects\(\)/u, "لا توجد redirects() في الإعداد");
  assert.match(config, /LEGACY_REDIRECTS/u);
  assert.match(config, /async rewrites\(\)[\s\S]*afterFiles: LEGACY_STORY_REWRITES/u, "روابط WordPress الرقمية بلا مسار إلى محلل المعرّف");
  assert.match(config, /X-Robots-Tag/u, "أصل Railway بلا noindex — ازدواج فهرسة مع الموقع القديم");
  assert.match(config, /railway/u);
});

test("المزود لا يحمّل الأرشيف كله: نافذة حديثة وترقيم SQL وبحث SQL", async () => {
  const provider = await read("lib/content/provider.ts");
  assert.match(provider, /RECENT_LIMIT = \d+/u, "لا سقف للنافذة الحديثة");
  assert.match(provider, /pageBySection/u, "لا ترقيم SQL للأقسام");
  assert.match(provider, /pageBySeries/u, "لا ترقيم SQL للسلاسل");
  assert.match(provider, /storiesTable\.searchText/u, "البحث لا يستخدم النص المفهرس");
  // تحقق من مخطط التشغيل؛ دقة التطبيع وتحديث الصفوف تختبران سلوكيًا في public-search.integration.
  assert.equal(stories.searchText.generated?.mode, "stored", "نص البحث يجب أن يُخزن بعد توليده");
  assert.equal(stories.searchText.generated?.type, "always", "نص البحث يجب أن يتحدث تلقائيًا عند الحفظ");
  assert.doesNotMatch(
    provider,
    /db\s*\n?\s*\.select\(\)\s*\n?\s*\.from\(storiesTable\)\s*\n?\s*\.where\(eq\(storiesTable\.status, "published"\)\)\s*\n?\s*\.orderBy\(desc\(storiesTable\.publishedAt\), asc\(storiesTable\.id\)\);/u,
    "عاد تحميل الأرشيف الكامل",
  );
});

test("مسار /tag ينفذ 301: وسم السلسلة إلى صفحتها وأي وسم آخر إلى أرشيف الكلمة", async () => {
  const route = await read("app/tag/[tag]/route.ts");
  assert.match(route, /TAG_TO_SERIES/u);
  assert.match(route, /status: 301/u);
  assert.match(route, /\/series\/\$\{series\}/u);
  assert.match(route, /\/keywords\//u, "الوسوم الحرة بلا وجهة أرشيف");
  assert.doesNotMatch(route, /search\?q=/u, "البحث noindex فلا يصلح وجهة 301 دائمة");
});

test("ترويسة تحويل المقال ASCII — الرابط العربي يُرمّز قبل Location", async () => {
  const page = await read("app/[section]/[id]/[slug]/page.tsx");
  assert.match(page, /permanentRedirect\(encodeURI\(storyHref\(story\)\)\)/u, "Location بالعربية الخام يرد 500");
});

test("قسما «غير مصنف» القديمان يتحولان دائمًا إلى منوعات", async () => {
  const page = await read("app/[section]/page.tsx");
  assert.match(page, /غير-مصنف/u);
  assert.match(page, /uncategorized/u);
  assert.match(page, /permanentRedirect\("\/varieties"\)/u);
});

test("الصفحات الإرثية الأربع حية بروابطها القديمة", async () => {
  const [about, contact, privacy, landing, chrome] = await Promise.all([
    read("app/about/page.tsx"),
    read("app/contact/page.tsx"),
    read("app/privacy-policy/page.tsx"),
    read("app/landing-page/page.tsx"),
    read("app/_components/site-chrome.tsx"),
  ]);
  assert.match(about, /العلم منصة إعلامية معرفية/u);
  assert.match(about, /المنصة المعرفية اليومية للمتلقي/u);
  assert.match(about, /صناعة التأثير عبر الإعلام/u);
  assert.match(contact, /شارع الأمير ناصر بن سعود/u);
  assert.match(contact, /\+966552653222/u);
  assert.match(contact, /alelm@trenddc\.com/u);
  assert.match(privacy, /حماية حقوق الطبع والملكية الفكرية/u);
  assert.match(privacy, /الكوكيز وإعدادات الشبكة/u);
  assert.match(privacy, /info@alelm\.net/u);
  assert.match(chrome, /href="\/about">من نحن/u);
  assert.match(chrome, /href="\/contact">تواصل معنا/u);
  assert.match(chrome, /href="\/privacy-policy">سياسة الخصوصية/u);
  assert.match(chrome, /href="\/sitemap\.xml">خريطة المنصة/u);
  assert.doesNotMatch(chrome, /المحتوى من مواد منشورة/u);
  assert.match(chrome, /سجّل بريدك في قائمة نشرة «العلم» لتصلك الإصدارات عند إطلاقها/u);
  assert.doesNotMatch(chrome, /بلا إعلانات|موجز أسبوعي يختصر/u);
  const sitemap = await read("app/sitemap.ts");
  assert.match(sitemap, /\$\{BASE_URL\}\/about/u);
  assert.match(sitemap, /\$\{BASE_URL\}\/contact/u);
  assert.match(sitemap, /\$\{BASE_URL\}\/privacy-policy/u);
  // الإرثية التسويقية خارج الفهرسة حتى لا تزاحم الرئيسية.
  assert.match(landing, /index: false/u);
});

test("أرشيف البودكاست الإرثي /podcasts حي ويقود إلى قناة العلم", async () => {
  const [page, sitemap, provider] = await Promise.all([
    read("app/podcasts/page.tsx"),
    read("app/sitemap.ts"),
    read("lib/content/provider.ts"),
  ]);
  assert.match(page, /listByFormat\("podcasts"/u, "الصفحة لا تستعلم مواد شكل البودكاست");
  assert.match(page, /youtube\.com\/c\/alelmmedia/u, "لا رابط لقناة الحلقات");
  assert.match(sitemap, /\/podcasts/u, "خريطة الموقع بلا أرشيف البودكاست");
  assert.match(provider, /listByFormat/u);
});

/* أشكال روابط ووردبريس التي كانت ترد 404 في تقرير Search Console (2026-09-16):
 * أرشيف /category، وترقيم /page/N، والخلاصات، وذيول المادة، وأرشيف الوسائط.
 */

test("أقسام طبقة التحويلات مطابقة لأقسام الموقع", async () => {
  const sections = await read("lib/content/sections.ts");
  const declared = [...sections.matchAll(/^\s*slug: "([a-z-]+)",$/gmu)].map((match) => match[1]);
  assert.deepEqual([...LEGACY_SECTION_SLUGS].sort(), [...new Set(declared)].sort());
});

test("أرشيفات ووردبريس القديمة: /category وترقيم /page/N تتحول دائمًا", () => {
  // بلا شرط استعلام: مصدر `/page/N` مكرر، نسخته الأولى للبحث `?s=`.
  const rule = (source) => LEGACY_REDIRECTS.find((item) => item.source === source && !item.has);
  for (const slug of LEGACY_SECTION_SLUGS) {
    assert.equal(rule(`/category/${slug}`)?.destination, `/${slug}`);
    assert.equal(rule(`/category/${slug}/page/:page(\\d+)`)?.destination, `/${slug}?p=:page`);
    assert.equal(rule(`/${slug}/page/:page(\\d+)`)?.destination, `/${slug}?p=:page`);
    assert.equal(rule(`/${slug}/feed`)?.destination, `/${slug}`);
  }
  assert.equal(rule("/category/uncategorized")?.destination, "/varieties");
  assert.equal(rule("/page/:page(\\d+)")?.destination, "/");
  // خلاصات RSS الجذرية تبقى 404 بقرار موثق — لا تحويل إلى الرئيسية.
  assert.equal(rule("/feed"), undefined);
  assert.equal(rule("/comments/feed"), undefined);
  assert.equal(rule("/jakalelm")?.destination, "/jak");
});

test("بحث ووردبريس \u200E?s=\u200E يتحول إلى صفحة البحث قبل قاعدة الترقيم العامة", () => {
  const search = LEGACY_REDIRECTS.filter((rule) => rule.destination.startsWith("/search?q="));
  assert.equal(search.length, 2, "الجذر وصفحات النتائج معًا");
  for (const rule of search) {
    assert.deepEqual(rule.has, [{ type: "query", key: "s", value: "(?<term>.+)" }]);
  }
  // القاعدة المشروطة بالاستعلام تسبق القاعدة العامة لكل مصدر مكرر، وإلا ابتلعتها.
  for (const source of ["/", "/page/:page(\\d+)"]) {
    const conditional = LEGACY_REDIRECTS.findIndex((rule) => rule.source === source && rule.has);
    const general = LEGACY_REDIRECTS.findIndex((rule) => rule.source === source && !rule.has);
    assert.ok(conditional >= 0, `لا قاعدة بحث للمصدر ${source}`);
    if (general >= 0) assert.ok(conditional < general, `قاعدة عامة تسبق البحث في ${source}`);
  }
});

test("أرشيف الوسائط الإرثي يبقى حيًا على مضيف ووردبريس", () => {
  const media = LEGACY_REDIRECTS.find((rule) => rule.source === "/wp-content/uploads/:path*");
  assert.equal(media?.destination, "https://dash.alelm.net/wp-content/uploads/:path*");
});

test("ذيول مسار المادة الرقمية تعود إلى محلل المعرّف بدل 404", () => {
  const sources = LEGACY_STORY_REWRITES.map((rule) => rule.source);
  assert.ok(sources.includes("/:id(\\d+)/feed"));
  assert.ok(sources.includes("/:id(\\d+)/:slug/:tail*"), "feed وcontact وprint بلا وجهة");
  for (const rule of LEGACY_STORY_REWRITES) {
    assert.ok(
      rule.destination === "/legacy/:id" || rule.destination === "/tag/:tag",
      `وجهة إعادة كتابة غير متوقعة: ${rule.destination}`,
    );
  }
});
