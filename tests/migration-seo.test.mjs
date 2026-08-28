import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { LEGACY_REDIRECTS, TAG_TO_SERIES } from "../lib/content/redirects.ts";

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
    assert.ok(rule.destination.startsWith("/"), `وجهة غير مطلقة: ${rule.destination}`);
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
  assert.match(sitemap, /story\.section.*story\.id.*encodeURIComponent\(story\.slug\)/su, "روابط المواد لا تحفظ الثلاثية");
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
  assert.match(config, /X-Robots-Tag/u, "أصل Railway بلا noindex — ازدواج فهرسة مع الموقع القديم");
  assert.match(config, /railway/u);
});

test("المزود لا يحمّل الأرشيف كله: نافذة حديثة وترقيم SQL وبحث SQL", async () => {
  const provider = await read("lib/content/provider.ts");
  assert.match(provider, /RECENT_LIMIT = \d+/u, "لا سقف للنافذة الحديثة");
  assert.match(provider, /pageBySection/u, "لا ترقيم SQL للأقسام");
  assert.match(provider, /pageBySeries/u, "لا ترقيم SQL للسلاسل");
  assert.match(provider, /translate\(lower\(/u, "البحث بلا تطبيع SQL");
  assert.doesNotMatch(
    provider,
    /db\s*\n?\s*\.select\(\)\s*\n?\s*\.from\(storiesTable\)\s*\n?\s*\.where\(eq\(storiesTable\.status, "published"\)\)\s*\n?\s*\.orderBy\(desc\(storiesTable\.publishedAt\), asc\(storiesTable\.id\)\);/u,
    "عاد تحميل الأرشيف الكامل",
  );
});

test("مسار /tag ينفذ 301: وسم السلسلة إلى صفحتها وأي وسم آخر إلى البحث", async () => {
  const route = await read("app/tag/[tag]/route.ts");
  assert.match(route, /TAG_TO_SERIES/u);
  assert.match(route, /status: 301/u);
  assert.match(route, /\/series\/\$\{series\}/u);
  assert.match(route, /search\?q=/u, "الوسوم الحرة بلا وجهة بحث");
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
  const [about, contact, privacy, landing] = await Promise.all([
    read("app/about/page.tsx"),
    read("app/contact/page.tsx"),
    read("app/privacy-policy/page.tsx"),
    read("app/landing-page/page.tsx"),
  ]);
  assert.match(about, /عن العلم/u);
  assert.match(contact, /تواصل/u);
  assert.match(privacy, /خصوصيتك ليست ثمن التخصيص/u);
  // القانونية الكاملة تُعتمد من المالك قبل الإطلاق — الصفحة تصرّح بذلك كما في iOS.
  assert.match(privacy, /السياسة القانونية الكاملة/u);
  // الإرثية التسويقية خارج الفهرسة حتى لا تزاحم الرئيسية.
  assert.match(landing, /index: false/u);
});
