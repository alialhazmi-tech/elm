import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { findVideoUrlInText, normalizeVideoUrl, videoEmbedUrl, youtubeIdFrom } from "../lib/content/video.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("روابط يوتيوب تُطبَّع إلى الفيديو وحده بلا قائمة تشغيل، وتُرفض غير يوتيوب", () => {
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

test("مادة الفيديو تُعرض مشغّلًا واسعًا تحت الرأس بالنسخة الخاصة بالخصوصية والسياسة تسمح بذلك الإطار وحده", async () => {
  const [page, styles, provider, config, route, migrate, schema, editor, details] = await Promise.all([
    read("app/[section]/[id]/[slug]/page.tsx"),
    read("app/soft.css"),
    read("lib/content/provider.ts"),
    read("next.config.ts"),
    read("app/api/tahrir/story/route.ts"),
    read("scripts/wp-migrate.mjs"),
    read("db/schema.ts"),
    read("components/tahrir/editor/editor-client.tsx"),
    read("components/tahrir/editor/details-panel.tsx"),
  ]);
  assert.match(page, /story\.format === "videos" \? videoEmbedUrl\(story\.videoUrl\) : null/);
  assert.match(page, /videoEmbed \? " has-video"/);
  assert.match(page, /<iframe[\s\S]*src=\{videoEmbed\}/);
  assert.match(styles, /\.sa-head\.has-video \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(styles, /\.sa-video iframe \{[^}]*width: 100%;[^}]*aspect-ratio: 16 \/ 9;/);
  assert.match(provider, /section === "videos"[\s\S]*or\(eq\(storiesTable\.section, section\), eq\(storiesTable\.format, "videos"\)\)/);
  assert.match(provider, /section === "videos" \? isVideo\(story\) : story\.section === section/);
  assert.match(config, /"frame-src https:\/\/www\.youtube-nocookie\.com"/);
  assert.doesNotMatch(config, /frame-src[^"]*youtube\.com[^-]/);
  // الحفظ يقبل يوتيوب فقط، والهجرة تسحب الرابط من واجهة الموقع القديم الخاصة.
  assert.match(route, /const videoUrl = normalizeVideoUrl\(input\.videoUrl\)/);
  assert.match(route, /input\.format\?\.trim\(\) === "videos" && !videoUrl/);
  assert.match(editor, /format === "videos" && !youtubeIdFrom\(videoUrl\)/);
  assert.match(details, /aria-label="تفعيل فيديو للمادة"/);
  assert.match(details, /onCheckedChange=\{\(checked\) => props\.onFormat\(checked \? "videos" : "news"\)\}/);
  assert.match(details, /ألصق رابط يوتيوب لإكمال المادة المرئية/);
  assert.match(migrate, /alelm-api\/v1"/);
  assert.match(migrate, /single-post\?id=\$\{postId\}/);
  assert.match(migrate, /video_url = coalesce\(excluded\.video_url, stories\.video_url\)/);
  assert.match(schema, /videoUrl: text\("video_url"\)/);
});
