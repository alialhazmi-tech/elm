import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { findVideoUrlInText, instagramPostUrlFrom, normalizeVideoUrl, videoEmbedUrl, xPostIdFrom, youtubeIdFrom } from "../lib/content/video.ts";

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

test("روابط Instagram تُطبَّع إلى منشور عام بصيغة canonical وتزيل معلمات التتبع", () => {
  const shortcode = "C0ffee_42";
  for (const url of [
    `https://instagram.com/reel/${shortcode}/?igsh=tracking&utm_source=share`,
    `http://www.instagram.com/reels/${shortcode}?utm_medium=social`,
    `https://m.instagram.com/p/${shortcode}/?fbclid=tracking`,
    `https://www.instagram.com/tv/${shortcode}/?foo=bar`,
  ]) {
    assert.equal(instagramPostUrlFrom(url), `https://www.instagram.com/${url.includes("/reels/") ? "reel" : url.match(/\/(p|tv|reel)\//)?.[1] ?? "reel"}/${shortcode}/`);
    assert.equal(normalizeVideoUrl(url), instagramPostUrlFrom(url));
    assert.equal(videoEmbedUrl(url), `https://www.instagram.com/${url.includes("/reels/") ? "reel" : url.match(/\/(p|tv|reel)\//)?.[1] ?? "reel"}/${shortcode}/embed/`);
  }
  for (const url of [
    "https://instagram.com/author",
    "https://instagram.com/stories/author/123",
    `https://instagram.com/reel/${shortcode}/extra`,
    `https://instagram.com.evil.test/reel/${shortcode}/`,
    `https://evil.test/instagram.com/reel/${shortcode}/`,
    `https://instagram.com@evil.test/reel/${shortcode}/`,
    `https://user:pass@instagram.com/reel/${shortcode}/`,
    `https://instagram.com:443/reel/${shortcode}/`,
    `https://instagram.com/reel/${shortcode}!/`,
    `ftp://instagram.com/reel/${shortcode}/`,
  ]) assert.equal(instagramPostUrlFrom(url), null, url);
  assert.equal(findVideoUrlInText(`<p>Instagram: https://instagram.com/reel/${shortcode}/</p>`), null,
    "legacy body migration remains YouTube-only");
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
  assert.match(player, /instagram/i);
  assert.match(player, /aspect-ratio|aspect-video/);
  assert.match(player, /href=\{(?:url|canonical|instagramUrl)\}|direct source|فتح (?:الفيديو|المنشور)/);
  assert.doesNotMatch(player, /XPost|createTweet/);
  assert.match(styles, /\.sa-head\.has-video \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(styles, /\.sa-video iframe \{[^}]*width: 100%;[^}]*aspect-ratio: 16 \/ 9;/);
  assert.match(provider, /section === "videos"[\s\S]*or\(eq\(storiesTable\.section, section\), eq\(storiesTable\.format, "videos"\)\)/);
  assert.match(provider, /section === "videos" \? isVideo\(story\) : story\.section === section/);
  assert.match(config, /["`]frame-src [^"`]*https:\/\/www\.youtube-nocookie\.com/);
  assert.match(config, /["`]frame-src [^"`]*https:\/\/www\.instagram\.com/);
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
