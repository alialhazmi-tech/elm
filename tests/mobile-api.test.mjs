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
  assert.match(route, /s-maxage=120/);
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
  assert.match(catalog, /mobile-story\.v1/);
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
