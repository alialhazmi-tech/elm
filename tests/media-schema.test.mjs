import assert from "node:assert/strict";
import test from "node:test";
import { podcastDurationIso, podcastEpisodeAnchor, podcastStructuredData, videoStructuredData } from "../lib/seo/media.ts";

const canonical = "https://alelm.net/videos/123/عنوان";
const story = { format: "videos", videoUrl: "https://youtu.be/abcdefghijk", title: "عنوان الفيديو", excerpt: "وصف الفيديو الظاهر للقارئ", publishedAt: "2026-10-12T08:00:00Z" };
const show = { id: "sample", storyId: null, name: "ملامح", description: "وصف البرنامج", feedUrl: "https://media.rss.com/malameh/feed.xml", youtube: "https://www.youtube.com/c/alelmmedia", accent: "#222" };
const episode = { title: "ملامح | موضوع الحلقة مع ضيف الحلقة", description: "وصف الحلقة المنشور", audioUrl: "/podcast-audio/episode.mp3", mime: "audio/mpeg", publishedAt: "2026-10-10T08:00:00Z", duration: "23:45", episode: "13", season: "1" };

test("video schema describes the rendered player and publication on the site without inventing rights or a media file", () => {
  const video = videoStructuredData(story, canonical);
  assert.equal(video["@type"], "VideoObject");
  assert.equal(video.name, story.title);
  assert.equal(video.description, story.excerpt);
  assert.equal(video.uploadDate, "2026-10-12T08:00:00.000Z");
  assert.equal(video.embedUrl, "https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0&modestbranding=1&hl=ar");
  assert.deepEqual(video.thumbnailUrl, ["https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg"]);
  assert.equal(video.associatedArticle["@id"], canonical+"#article");
  for (const key of ["contentUrl", "duration", "transcript", "author", "publisher", "copyrightHolder"]) assert.equal(key in video, false);
});

test("non-video posts, unverified social embeds and incomplete video data are omitted", () => {
  for (const change of [{ format: "news" }, { videoUrl: "https://x.com/i/status/123" }, { videoUrl: "https://instagram.com/p/example" }, { videoUrl: "https://youtube.com.evil/watch?v=abcdefghijk" }, { publishedAt: "not-date" }, { publishedAt: undefined }, { title: " " }, { excerpt: "" }]) {
    assert.equal(videoStructuredData({ ...story, ...change }, canonical), null);
  }
});

test("podcast graph matches displayed names, dates, audio and canonical episode anchors", () => {
  const graph = podcastStructuredData({ show, episodes: [episode], canonicalUrl: canonical, cover: "/cover.jpg", description: "الوصف المعروض" })["@graph"];
  const [series, item] = graph;
  assert.equal(series["@type"], "PodcastSeries");
  assert.equal(series.description, "الوصف المعروض");
  assert.equal(series.publisher["@id"], "https://alelm.net/#organization");
  assert.equal(series.image, "https://alelm.net/cover.jpg");
  assert.equal(item.name, "موضوع الحلقة");
  assert.equal(item.partOfSeries["@id"], series["@id"]);
  assert.equal(series.episode[0]["@id"], item["@id"]);
  assert.equal(item.url, canonical+"#"+podcastEpisodeAnchor(episode.audioUrl));
  assert.equal(item.associatedMedia.contentUrl, "https://alelm.net/podcast-audio/episode.mp3");
  assert.equal(item.associatedMedia.duration, "PT1425S");
  assert.equal(item.datePublished, "2026-10-10T08:00:00.000Z");
  assert.equal(item.episodeNumber, "13");
  assert.equal("author" in item, false);
  assert.equal("transcript" in item, false);
});

test("episode identities survive reordering and equivalent relative/absolute audio URLs", () => {
  const second = { ...episode, audioUrl: "https://content.rss.com/episode2.mp3" };
  const render = episodes => podcastStructuredData({ show, episodes, canonicalUrl: canonical })["@graph"].slice(1);
  assert.equal(render([episode, second])[0]["@id"], render([second, episode])[1]["@id"]);
  assert.equal(podcastEpisodeAnchor(episode.audioUrl), podcastEpisodeAnchor("https://alelm.net"+episode.audioUrl));
  assert.notEqual(podcastEpisodeAnchor(episode.audioUrl), podcastEpisodeAnchor(second.audioUrl));
});

test("podcast schema omits unsafe URLs and unavailable data without fabricating values", () => {
  for (const audioUrl of ["javascript:alert(1)", "data:audio/mpeg;base64,abc", "https://user:password@example.com/audio.mp3", ""]) {
    const graph = podcastStructuredData({ show, episodes: [{ ...episode, audioUrl }], canonicalUrl: canonical })["@graph"];
    assert.equal(graph.length, 1);
    assert.deepEqual(graph[0].episode, []);
  }
  const item = podcastStructuredData({ show, episodes: [{ ...episode, duration: "unknown", publishedAt: "bad-date", mime: "text/html", episode: "unknown" }], canonicalUrl: canonical })["@graph"][1];
  assert.equal(item.datePublished, undefined);
  assert.equal(item.timeRequired, undefined);
  assert.equal(item.episodeNumber, undefined);
  assert.equal(item.associatedMedia.encodingFormat, undefined);
});

test("podcast durations accept known RSS formats and reject malformed values", () => {
  assert.equal(podcastDurationIso("3601"), "PT3601S");
  assert.equal(podcastDurationIso("1:00:01"), "PT3601S");
  assert.equal(podcastDurationIso("61:01"), "PT3661S");
  for (const value of [null, "", "0", "1:60", "-2", "1.5", "1:00:00:01", "unknown"]) assert.equal(podcastDurationIso(value), undefined);
});
