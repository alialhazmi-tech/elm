import assert from "node:assert/strict";
import test from "node:test";
import { renderVideoSitemap, sitemapVideo } from "../lib/content/video-sitemap.ts";
const story = {id:"123", section:"sciences", slug:"خبر-العلم", title:'عنوان < & "', excerpt:"وصف <الفيديو> & التفاصيل", format:"videos", videoUrl:"https://youtu.be/abcdefghijk"};

test("video sitemap uses the real player and canonical article, with XML escaping", () => {
  const video = sitemapVideo(story);
  assert.equal(video.url, "https://alelm.net/sciences/123/"+encodeURIComponent(story.slug));
  assert.equal(video.thumbnail, "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
  const xml = renderVideoSitemap([story]);
  assert.match(xml, /<video:player_loc>https:\/\/www.youtube-nocookie.com\/embed\/abcdefghijk\?rel=0&amp;modestbranding=1&amp;hl=ar<\/video:player_loc>/);
  assert.ok(xml.includes('&lt;الفيديو&gt; &amp; التفاصيل'));
  assert.ok(!xml.includes('<الفيديو>'));
  assert.equal((xml.match(/<url>/g)||[]).length, 1);
});

test("ineligible and unverifiable videos never enter the sitemap", () => {
  for (const changes of [{format:"articles"},{videoUrl:"javascript:alert(1)"},{videoUrl:"https://youtube.com.evil/watch?v=abcdefghijk"},{videoUrl:"https://www.instagram.com/p/123/"},{excerpt:" "},{title:" "},{videoUrl:null}]) {
    assert.equal(sitemapVideo({...story,...changes}), null);
  }
  assert.ok(!renderVideoSitemap([]).includes('<url>'));
});

test("video sitemap enforces text limits without invalid XML control characters", () => {
  const xml=renderVideoSitemap([{...story,title:'ع'.repeat(110),excerpt:'ب'.repeat(2050)}]);
  assert.ok(xml.includes('<video:title>'+ 'ع'.repeat(100) +'</video:title>'));
  assert.ok(xml.includes('<video:description>'+ 'ب'.repeat(2048) +'</video:description>'));
  assert.ok(!renderVideoSitemap([{...story,excerpt:'وصف\u0000الفيديو'}]).includes('\u0000'));
});
