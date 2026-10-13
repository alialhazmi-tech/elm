import assert from "node:assert/strict";
import test from "node:test";
import { renderRss, RSS_LIMIT } from "../lib/content/rss.ts";

const story = {
  id: "editorial-uuid", publicNumber: 300001, section: "sciences", slug: "خبر-العلم",
  title: "عنوان & تفاصيل", excerpt: "<p>ملخص &amp; معلومات عن الخبر</p>",
  publishedAt: "2026-10-12T10:00:00Z",
};
const now = Date.parse("2026-10-13T12:00:00Z");

test("RSS uses canonical public URLs, real publication dates and safe Arabic summaries", () => {
  const xml = renderRss([{ ...story, body: "PRIVATE FULL BODY", authorId: "PRIVATE AUTHOR" }], now);
  const url = "https://alelm.net/sciences/300001/" + encodeURIComponent(story.slug);
  assert.ok(xml.includes(`<link>${url}</link>`));
  assert.ok(xml.includes(`<guid isPermaLink="true">${url}</guid>`));
  assert.ok(xml.includes("<pubDate>Mon, 12 Oct 2026 10:00:00 GMT</pubDate>"));
  assert.ok(xml.includes("<title>عنوان &amp; تفاصيل</title>"));
  assert.ok(xml.includes("<description>ملخص &amp;amp; معلومات عن الخبر</description>"));
  assert.doesNotMatch(xml, /PRIVATE|editorial-uuid|<p>/);
  const unsafe = renderRss([{ ...story, excerpt: '<img src=x onerror=alert(1)> & \u0000 ]]> "' }], now);
  assert.doesNotMatch(unsafe, /<img|\]\]>/);
  assert.ok(!unsafe.includes("\u0000"));
  assert.ok(renderRss([{ ...story, excerpt: '<p>&lt;img src=x onerror=alert(1)&gt;</p>' }], now).includes("&amp;lt;img"));
});

test("RSS ignores aliases, duplicates, missing titles and invalid or future dates", () => {
  const xml = renderRss([
    story, story, { ...story, id: "1658" },
    { ...story, publicNumber: 300002, publishedAt: "bad-date" },
    { ...story, publicNumber: 300003, publishedAt: undefined },
    { ...story, publicNumber: 300004, publishedAt: "2099-01-01T00:00:00Z" },
    { ...story, publicNumber: 300005, title: " " },
  ], now);
  assert.equal((xml.match(/<item>/g) || []).length, 1);
});

test("RSS orders by publication, caps at 50 and does not promote boosted stories", () => {
  const entries = Array.from({ length: 60 }, (_, index) => ({
    ...story, id: String(index), publicNumber: 300001 + index,
    publishedAt: new Date(now - (index + 1) * 60_000).toISOString(),
  }));
  entries.at(-1).boostedAt = new Date(now).toISOString();
  const xml = renderRss(entries.reverse(), now);
  assert.equal((xml.match(/<item>/g) || []).length, RSS_LIMIT);
  assert.ok(xml.indexOf("/300001/") < xml.indexOf("/300002/"));
  assert.doesNotMatch(xml, /\/300060\//);
  assert.doesNotMatch(renderRss([], now), /<item>/);
});
