import assert from "node:assert/strict";
import test from "node:test";

import { parseRssEpisodes, PODCAST_SHOWS, podcastShowFor } from "../lib/podcasts.ts";

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel><title>ملامح</title>
<item>
  <title><![CDATA[الناقد المطالب بحقوق الفنانين]]></title>
  <pubDate>Thu, 09 Jan 2025 16:36:01 GMT</pubDate>
  <enclosure url="https://content.rss.com/episodes/187671/1840234/malameh/ep13.mp3" length="53294" type="audio/mpeg"/>
  <itunes:duration>23:45</itunes:duration>
  <itunes:episode>13</itunes:episode>
  <itunes:season>1</itunes:season>
  <description><![CDATA[<p>حلقة جديدة من #بودكاست_ملامح يتحدث فيها عبدالرحمن الناصر&nbsp;عن مشواره</p>]]></description>
</item>
<item>
  <title>حلقة بلا صوت — تُسقط</title>
  <pubDate>Wed, 01 Jan 2025 10:00:00 GMT</pubDate>
</item>
</channel></rss>`;

test("محلل الخلاصة يخرج الحلقات بصوتها ويجرد HTML الوصف ويسقط ما بلا مرفق", () => {
  const episodes = parseRssEpisodes(FIXTURE);
  assert.equal(episodes.length, 1, "الحلقة بلا enclosure يجب أن تُسقط");
  const [ep] = episodes;
  assert.equal(ep.title, "الناقد المطالب بحقوق الفنانين");
  assert.equal(ep.audioUrl, "https://content.rss.com/episodes/187671/1840234/malameh/ep13.mp3");
  assert.equal(ep.mime, "audio/mpeg");
  assert.equal(ep.episode, "13");
  assert.equal(ep.duration, "23:45");
  assert.match(ep.description, /^حلقة جديدة من #بودكاست_ملامح/u);
  assert.doesNotMatch(ep.description, /<p>|&nbsp;/u, "وصف الحلقة يصل نصًا نظيفًا");
  assert.equal(ep.publishedAt, "2025-01-09T16:36:01.000Z");
});

test("برامج البودكاست الأربعة معرفاتها محفوظة والغبوق بلا خلاصة عمدًا كما في المصدر", () => {
  assert.equal(PODCAST_SHOWS.length, 4);
  for (const id of ["175839", "92137", "71148", "70190"]) {
    assert.ok(podcastShowFor(id), `البرنامج ${id} غائب`);
  }
  assert.equal(podcastShowFor("175839")?.feedUrl, null);
  for (const slug of ["malameh", "atmahpodcast", "alelmbodcast"]) {
    assert.ok(PODCAST_SHOWS.some((show) => show.feedUrl?.includes(slug)), `خلاصة ${slug} غائبة`);
  }
});

test("قالب المقال يعرض الحلقات لمواد شكل podcasts بمشغل أصلي وسياسة الأمان تسمح ببثها", async () => {
  const { readFile } = await import("node:fs/promises");
  const [page, config] = await Promise.all([
    readFile(new URL("../app/[section]/[id]/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /story\.format === "podcasts"/u);
  assert.match(page, /fetchEpisodes\(podcastShow\)/u);
  assert.match(page, /<audio controls preload="none"/u, "مشغل المتصفح الأصلي غائب");
  assert.match(config, /media-src 'self' https:\/\/content\.rss\.com https:\/\/media\.rss\.com/u, "CSP لا يسمح بصوتيات الخلاصة");
});
