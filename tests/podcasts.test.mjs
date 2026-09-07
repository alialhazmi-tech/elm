import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPodcastDuration,
  parseRssEpisodes,
  PODCAST_SHOWS,
  podcastShowFor,
  presentEpisode,
  stripShowPrefix,
} from "../lib/podcasts.ts";

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel><title>ملامح</title>
<item>
  <title><![CDATA[الناقد المطالب بحقوق الفنانين]]></title>
  <pubDate>Thu, 09 Jan 2025 16:36:01 GMT</pubDate>
  <enclosure url="https://content.rss.com/episodes/187671/1840234/malameh/ep13.mp3" length="53294" type="audio/mpeg"/>
  <itunes:duration>23:45</itunes:duration>
  <itunes:episodeType>full</itunes:episodeType>
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

test("برامج البودكاست الأربعة معرفاتها محفوظة ومرتبطة بخلاصاتها الصوتية", () => {
  assert.equal(PODCAST_SHOWS.length, 4);
  for (const id of ["175839", "92137", "71148", "70190"]) {
    assert.ok(podcastShowFor(id), `البرنامج ${id} غائب`);
  }
  assert.equal(podcastShowFor("175839")?.feedUrl, "https://media.rss.com/alghabouk/feed.xml");
  for (const slug of ["alghabouk", "malameh", "atmahpodcast", "alelmbodcast"]) {
    assert.ok(PODCAST_SHOWS.some((show) => show.feedUrl?.includes(slug)), `خلاصة ${slug} غائبة`);
  }
});

test("عنوان الحلقة يُنظَّف من تكرار اسم البرنامج ويُفصل الضيف والمدة", () => {
  assert.equal(stripShowPrefix("العلم | بودكاست عتمة | فلسفة الحب", "عتمة"), "فلسفة الحب");
  assert.equal(stripShowPrefix("بودكاست عتمة | اللغة و البنية النفسية", "عتمة"), "اللغة و البنية النفسية");
  const presented = presentEpisode("العلم | بودكاست عتمة | ما وراء السجون مع ياسر البحري", "عتمة");
  assert.equal(presented.title, "ما وراء السجون");
  assert.equal(presented.guest, "ياسر البحري");
  assert.equal(formatPodcastDuration("4517"), "1:15:17");
  assert.equal(formatPodcastDuration("23:45"), "23:45");
});

test("قالب المقال يشغّل الحلقات بمشغل «الطبعة التحريرية» وسياسة الأمان تسمح ببثها", async () => {
  const { readFile } = await import("node:fs/promises");
  const [page, player, dock, config] = await Promise.all([
    readFile(new URL("../app/[section]/[id]/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/podcast-player.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/podcast-dock.tsx", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /story\.format === "podcasts"/u);
  assert.match(page, /<PodcastPlayer/u, "مكون المشغل غير مستخدم في القالب");
  assert.match(page, /podcast-show/u, "غلاف البرنامج الضخم ما زال قالب المقال");
  assert.match(page, /presentEpisode/u);
  assert.match(player, /"use client"/u);
  assert.match(player, /pp-ep-fields/u, "بطاقة الحلقة بلا حقول الضيف/المدة");
  assert.match(player, /pp-ico/u, "لا أيقونات أمام المدة والتاريخ");
  assert.match(dock, /pp-seek/u, "لا شريط تقدم");
  assert.match(dock, /RATES/u, "لا سرعة تشغيل");
  assert.match(dock, /skip\(-15\)/u, "لا قفز للخلف");
  assert.match(dock, /pp-bar/u, "لا شريط تشغيل ثابت");
  assert.match(dock, /position: fixed|PodcastDockProvider/u);
  assert.match(config, /media-src 'self' blob: https:/u, "CSP يسمح ببث الحلقات وملفات الموجز الصوتية المحلية");
  const shows = await readFile(new URL("../lib/podcasts.ts", import.meta.url), "utf8");
  assert.match(shows, /accent: "#/u);
});
