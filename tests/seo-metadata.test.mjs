import assert from "node:assert/strict";
import test from "node:test";

import { articleMetaDescription, archiveMetaDescription, cleanMetadataTitle } from "../lib/seo/metadata.ts";
import { breadcrumbStructuredData } from "../lib/seo/breadcrumbs.ts";
import { articleStructuredData, ORGANIZATION_ID, siteStructuredData } from "../lib/seo/schema.ts";

test("metadata helpers preserve editorial title and description overrides", () => {
  assert.equal(cleanMetadataTitle("  عنوان  ", "fallback"), "عنوان");
  assert.equal(articleMetaDescription({ title: "عنوان", seoDescription: "  وصف تحريري  ", excerpt: "نبذة" }), "وصف تحريري");
});

test("metadata titles remove only repeated trailing site brand suffixes", () => {
  assert.equal(cleanMetadataTitle("عنوان | العلم"), "عنوان");
  assert.equal(cleanMetadataTitle("عنوان | العلم | العلم"), "عنوان");
  assert.equal(cleanMetadataTitle("دور العلم"), "دور العلم");
});

test("article fallback differentiates shared generic excerpts without an arbitrary id", () => {
  const first = articleMetaDescription({ title: "قرار مجلس الوزراء الجديد", excerpt: "التفاصيل في متن المادة" });
  const second = articleMetaDescription({ title: "تحديث آخر في مجلس الوزراء", excerpt: "التفاصيل في متن المادة" });
  assert.notEqual(first, second);
  assert.match(first, /قرار مجلس الوزراء الجديد/);
  assert.doesNotMatch(first, /\b(?:id|uuid)\b/i);
});

test("article fallback uses cleaned body context and stays concise", () => {
  const description = articleMetaDescription({
    title: "عنوان قصير",
    excerpt: "",
    body: `<p>${"معلومة تحريرية مهمة عن الحدث. ".repeat(80)}</p>`,
  });
  assert.match(description, /^عنوان قصير — معلومة تحريرية مهمة عن الحدث/);
  assert.ok(Array.from(description).length <= 201);
  assert.doesNotMatch(description, /<p>/);
});

test("archive descriptions include page context only after the first page", () => {
  const base = "تغطية معرفية متخصصة";
  assert.equal(archiveMetaDescription(base, 1), base);
  assert.equal(archiveMetaDescription(base, 3), `${base} — الصفحة 3`);
});

test("site schema identifies the news organization and website without SearchAction", () => {
  const graph = siteStructuredData()["@graph"];
  assert.equal(graph[0]["@type"], "NewsMediaOrganization");
  assert.equal(graph[1]["@type"], "WebSite");
  assert.equal(graph[1].publisher["@id"], ORGANIZATION_ID);
  assert.equal("potentialAction" in graph[1], false);
});

test("article schema links the canonical article and omits absent bylines", () => {
  const story = { id: "1", title: "عنوان", excerpt: "نبذة عن المادة", section: "world", image: "/image.jpg" };
  const schema = articleStructuredData({ story, canonicalUrl: "https://alelm.net/world/1/title", sectionName: "عالم" });
  assert.equal(schema["@id"], "https://alelm.net/world/1/title#article");
  assert.deepEqual(schema.mainEntityOfPage, { "@type": "WebPage", "@id": "https://alelm.net/world/1/title" });
  assert.deepEqual(schema.publisher, { "@id": ORGANIZATION_ID });
  assert.equal("author" in schema, false);
  assert.deepEqual(schema.image, ["https://alelm.net/image.jpg"]);
});

test("article schema omits malformed and non-http images without throwing", () => {
  const story = { id: "1", title: "عنوان", excerpt: "نبذة", section: "world" };
  for (const image of ["http://[broken", "javascript:alert(1)", "data:image/png;base64,abc"]) {
    const schema = articleStructuredData({
      story: { ...story, image },
      canonicalUrl: "https://alelm.net/world/1/title",
      sectionName: "عالم",
    });
    assert.equal(schema.image, undefined);
    assert.equal("image" in schema, false);
  }
});

test("article schema only announces valid publication and later modification dates", () => {
  const story = { id: "1", title: "عنوان", excerpt: "نبذة", section: "world", publishedAt: "2026-09-21T08:00:00Z" };
  const schemaFor = updatedAt => articleStructuredData({ story: { ...story, updatedAt }, canonicalUrl: "https://alelm.net/world/1/title", sectionName: "عالم" });
  for(const value of ["not-a-date", "2026-09-20T08:00:00Z", story.publishedAt]) assert.equal(schemaFor(value).dateModified, undefined);
  assert.equal(schemaFor("2026-09-21T09:00:00Z").dateModified, "2026-09-21T09:00:00Z");
});

test("breadcrumb schema leaves the visible current item without an item URL", () => {
  const schema = breadcrumbStructuredData([
    { label: "الرئيسية", href: "/" },
    { label: "عالم", href: "/world" },
    { label: "عنوان المادة" },
  ]);
  assert.equal(schema.itemListElement.at(-1).name, "عنوان المادة");
  assert.equal("item" in schema.itemListElement.at(-1), false);
  assert.equal(schema.itemListElement[1].item, "https://alelm.net/world");
});
