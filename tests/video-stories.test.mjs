import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { findVideoUrlInText, normalizeVideoUrl, videoEmbedUrl, xPostIdFrom, youtubeIdFrom } from "../lib/content/video.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("X post links normalize across supported hosts and reject unsafe or unrelated URLs", () => {
  const id = '560070183650213889';
  for (const url of [
    `https://x.com/TwitterDev/status/${id}?s=20&t=tracking`,
    `https://twitter.com/TwitterDev/status/${id}/video/1`,
    `https://mobile.twitter.com/TwitterDev/status/${id}`,
    `https://www.x.com/i/status/${id}`,
    `https://x.com/i/web/status/${id}/`,
  ]) {
    assert.equal(xPostIdFrom(url), id);
    assert.equal(normalizeVideoUrl(url), `https://x.com/i/status/${id}`);
    assert.equal(videoEmbedUrl(url), `https://twitter.com/i/videos/tweet/${id}?language_code=ar&dnt=true`, 'X video must use the standalone player');
  }
  for (const url of [
    'https://x.com/TwitterDev', 'https://x.com/search?q=video',
    `https://x.com.evil.test/TwitterDev/status/${id}`, `https://evil.test/x.com/user/status/${id}`,
    `https://x.com@evil.test/user/status/${id}`, `https://user:pass@x.com/user/status/${id}`,
    `ftp://x.com/user/status/${id}`, `https://x.com:8443/user/status/${id}`,
    'https://x.com/user/status/0', 'https://x.com/user/status/not-an-id',
    `https://x.com/user/status/${id}/anything`, 'javascript:alert(1)',
  ]) assert.equal(normalizeVideoUrl(url), null, url);
  assert.equal(normalizeVideoUrl('ftp://youtube.com/watch?v=vEaijy5naDA'), null);
});

test("روابط يوتيوب تُطبَّع إلى الفيديو وحده بلا قائمة تشغيل، وتُرفض الروابط غير المدعومة", () => {
  const withList = "https://www.youtube.com/watch?v=vEaijy5naDA&list=PL4VhCfbX4rSutOI8kjHc0NQxm0HiiZAhH";
  assert.equal(youtubeIdFrom(withList), "vEaijy5naDA");
  assert.equal(normalizeVideoUrl(withList), "https://www.youtube.com/watch?v=vEaijy5naDA");
  assert.equal(normalizeVideoUrl("https://youtu.be/vEaijy5naDA?t=30"), "https://www.youtube.com/watch?v=vEaijy5naDA");
  assert.equal(normalizeVideoUrl("https://www.youtube.com/embed/vEaijy5naDA"), "https://www.youtube.com/watch?v=vEaijy5naDA");
  assert.equal(normalizeVideoUrl("https://www.youtube.com/shorts/vEaijy5naDA"), "https://www.youtube.com/watch?v=vEaijy5naDA");
  assert.equal(normalizeVideoUrl("https://www.youtube.com/watch/pQcyUsm6a0k?si=zwoQ0I3bERyD7rAd"), "https://www.youtube.com/watch?v=pQcyUsm6a0k");
  assert.equal(findVideoUrlInText('<p>شاهد: <a href="https://youtube.com/shorts/RGkitaznZ7Q?feature=share">هنا</a></p>'), "https://www.youtube.com/watch?v=RGkitaznZ7Q");
  assert.equal(findVideoUrlInText("نص بلا رابط"), null);
  assert.equal(normalizeVideoUrl("https://vimeo.com/123"), null);
  assert.equal(normalizeVideoUrl("javascript:alert(1)"), null);
  assert.equal(normalizeVideoUrl(""), null);
  assert.equal(videoEmbedUrl(withList), "https://www.youtube-nocookie.com/embed/vEaijy5naDA?rel=0&modestbranding=1&hl=ar");
  assert.doesNotMatch(videoEmbedUrl(withList), /list=/);
});

test("المحرر وصفحة المادة يستخدمان نفس المشغّل وسياسة المحتوى تسمح بمضيفي التضمين المحددين", async () => {
  const [page, styles, provider, config, route, migrate, schema, editor, details, player] = await Promise.all([
    read("app/[section]/[id]/[slug]/page.tsx"),
    read("app/soft.css"),
    read("lib/content/provider.ts"),
    read("next.config.ts"),
    read("app/api/tahrir/story/route.ts"),
    read("scripts/wp-migrate.mjs"),
    read("db/schema.ts"),
    read("components/tahrir/editor/editor-client.tsx"),
    read("components/tahrir/editor/details-panel.tsx"),
    read("components/content/video-player.tsx"),
  ]);
  assert.match(page, /story\.format === "videos" \? normalizeVideoUrl\(story\.videoUrl\) : null/);
  assert.match(page, /videoUrl \? " has-video"/);
  assert.match(page, /<VideoPlayer url=\{videoUrl\}/);
  assert.match(player, /<iframe src=\{embed\}/);
  assert.doesNotMatch(player, /XPost|createTweet/);
  assert.match(styles, /\.sa-head\.has-video \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(styles, /\.sa-video iframe \{[^}]*width: 100%;[^}]*aspect-ratio: 16 \/ 9;/);
  assert.match(provider, /section === "videos"[\s\S]*or\(eq\(storiesTable\.section, section\), eq\(storiesTable\.format, "videos"\)\)/);
  assert.match(provider, /section === "videos" \? isVideo\(story\) : story\.section === section/);
  assert.match(config, /"frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/www\.googletagmanager\.com https:\/\/platform\.twitter\.com https:\/\/syndication\.twitter\.com https:\/\/twitter\.com\/i\/videos\/tweet\/ https:\/\/x\.com\/i\/videos\/tweet\/"/);
  assert.doesNotMatch(config, /frame-src[^"]*youtube\.com[^-]/);
  // الحفظ يقبل يوتيوب وتغريدات X، والهجرة تسحب الرابط من واجهة الموقع القديم الخاصة.
  assert.match(route, /const videoUrl = normalizeVideoUrl\(input\.videoUrl\)/);
  assert.match(route, /input\.format\?\.trim\(\) === "videos" && !videoUrl/);
  assert.match(editor, /format === "videos" && !normalizeVideoUrl\(videoUrl\)/);
  assert.match(details, /aria-label="تفعيل فيديو للمادة"/);
  assert.match(details, /onCheckedChange=\{\(checked\) => props\.onFormat\(checked \? "videos" : "news"\)\}/);
  assert.match(details, /ألصق رابط يوتيوب أو تغريدة عامة تحتوي على فيديو/);
  assert.match(migrate, /alelm-api\/v1"/);
  assert.match(migrate, /single-post\?id=\$\{postId\}/);
  assert.match(migrate, /video_url = coalesce\(excluded\.video_url, stories\.video_url\)/);
  assert.match(schema, /videoUrl: text\("video_url"\)/);
});
