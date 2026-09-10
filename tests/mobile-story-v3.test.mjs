import assert from "node:assert/strict";
import test from "node:test";

import { storyBody, storyKeywordLinks, storyPodcast, storyVideo, toMobileEpisode } from "../lib/mobile/story-extras.ts";
import { toMobileTaxonomy } from "../lib/mobile/taxonomy.ts";

const ORIGIN = "https://elm-production-5035.up.railway.app";

test("متن HTML من المحرر يُنقّى ثم يُحوَّل إلى كتل وروابط مصادر", () => {
  const body = '<p>فقرة <b>غامقة</b> <a href="https://example.org/report?x=1&amp;y=2" onclick="evil()">المصدر</a></p><script>alert(1)</script><h2>عنوان</h2>';
  const result = storyBody(body);
  assert.equal(result.bodyHtml, '<p>فقرة <strong>غامقة</strong> <a href="https://example.org/report?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">المصدر</a></p><h2>عنوان</h2>');
  assert.deepEqual(result.blocks, [
    { type: "paragraph", runs: [{ text: "فقرة " }, { text: "غامقة", bold: true }, { text: " " }, { text: "المصدر", href: "https://example.org/report?x=1&y=2" }] },
    { type: "heading", level: 2, runs: [{ text: "عنوان" }] },
  ]);
  assert.deepEqual(result.links, [{ href: "https://example.org/report?x=1&y=2", label: "المصدر" }]);
});

test("المتن الإرثي بلا وسوم يصبح فقرات HTML وكتلًا متطابقة", () => {
  const result = storyBody("سطر أول\nسطر ثانٍ\n\nفقرة ثانية & ثالثة");
  assert.equal(result.bodyHtml, "<p>سطر أول<br>سطر ثانٍ</p><p>فقرة ثانية &amp; ثالثة</p>");
  assert.deepEqual(result.blocks, [
    { type: "paragraph", runs: [{ text: "سطر أول\nسطر ثانٍ" }] },
    { type: "paragraph", runs: [{ text: "فقرة ثانية & ثالثة" }] },
  ]);
  assert.deepEqual(result.links, []);
  assert.deepEqual(storyBody(undefined), { bodyHtml: "", blocks: [], links: [] });
});

test("الفيديو يُطبَّع من الحقل أو يُلتقط من المتن ويُصنَّف بنوعه", () => {
  assert.deepEqual(storyVideo({ format: "videos", videoUrl: "https://youtu.be/dQw4w9WgXcQ?si=abc" }), {
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoEmbedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&hl=ar",
    videoKind: "youtube",
  });
  assert.deepEqual(storyVideo({ format: "videos", videoUrl: "https://x.com/alelm/status/1830000000000000001" }), {
    videoUrl: "https://x.com/i/status/1830000000000000001",
    videoEmbedUrl: "https://twitter.com/i/videos/tweet/1830000000000000001?language_code=ar&dnt=true",
    videoKind: "x",
  });
  assert.deepEqual(storyVideo({ format: "videos", videoUrl: "https://www.instagram.com/reels/ABCdef123/" }), {
    videoUrl: "https://www.instagram.com/reel/ABCdef123/",
    videoEmbedUrl: "https://www.instagram.com/reel/ABCdef123/embed/",
    videoKind: "instagram",
  });
  // الحقل فارغ والرابط في المتن (مواد قديمة).
  assert.equal(storyVideo({ format: "videos", videoUrl: null, body: "<p>شاهد https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;t=5</p>" }).videoKind, "youtube");
  // قاعدة الويب: لا مشغّل لخبر يحمل رابط يوتيوب في متنه أو حقله.
  assert.deepEqual(storyVideo({ format: "news", videoUrl: "https://youtu.be/dQw4w9WgXcQ", body: "<p>https://www.youtube.com/watch?v=dQw4w9WgXcQ</p>" }), { videoUrl: null, videoEmbedUrl: null, videoKind: null });
  assert.deepEqual(storyVideo({ format: "videos", videoUrl: "https://example.com/video.mp4", body: "لا رابط" }), { videoUrl: null, videoEmbedUrl: null, videoKind: null });
  assert.deepEqual(storyVideo({}), { videoUrl: null, videoEmbedUrl: null, videoKind: null });
});

test("الكلمات المفتاحية الصريحة تصبح روابط أرشيف مرمّزة بلا تكرار", () => {
  assert.deepEqual(storyKeywordLinks([" الرياض ", "الرياض", "", 7, "ذكاء اصطناعي"]), [
    { keyword: "الرياض", href: `/keywords/${encodeURIComponent("الرياض")}` },
    { keyword: "ذكاء اصطناعي", href: `/keywords/${encodeURIComponent("ذكاء اصطناعي")}` },
  ]);
  assert.deepEqual(storyKeywordLinks(null), []);
  assert.deepEqual(storyKeywordLinks("نص"), []);
});

test("البودكاست يُرفق لمواد شكل «بودكاست» المسجّلة فقط وبروابط صوت مطلقة", async () => {
  const rssEpisode = { title: "حلقة", audioUrl: "https://content.rss.com/x.mp3", mime: "audio/mpeg", publishedAt: "2026-09-01T00:00:00.000Z", duration: "23:45", description: "وصف", episode: "3", season: "1" };
  const hosted = { ...rssEpisode, title: "مضيفة", audioUrl: "/podcast-audio/a.m4a", mime: "audio/mp4", episode: null, season: null };
  const loader = async (show) => (show.storyId === "175839" ? [rssEpisode, hosted] : []);

  const podcast = await storyPodcast({ id: "175839", format: "podcasts", image: "/uploads/story.jpg" }, ORIGIN, loader);
  assert.deepEqual(podcast.show, { storyId: "175839", name: "الغبوق", cover: `${ORIGIN}/podcasts/alghabouq.jpg`, accent: "#b35c1e", youtube: "https://www.youtube.com/c/alelmmedia" });
  assert.deepEqual(podcast.episodes, [toMobileEpisode(rssEpisode, ORIGIN), toMobileEpisode(hosted, ORIGIN)]);
  assert.equal(podcast.episodes[0].audioUrl, "https://content.rss.com/x.mp3");
  assert.equal(podcast.episodes[1].audioUrl, `${ORIGIN}/podcast-audio/a.m4a`);

  // برنامج بلا غلاف معتمد يأخذ صورة المادة؛ فشل الخلاصة يعطي حلقات فارغة لا خطأ.
  const failing = await storyPodcast({ id: "92137", format: "podcasts", image: "/uploads/malameh.jpg" }, ORIGIN, async () => { throw new Error("feed down"); });
  assert.equal(failing.show.name, "ملامح");
  assert.equal(failing.show.cover, `${ORIGIN}/uploads/malameh.jpg`);
  assert.deepEqual(failing.episodes, []);

  assert.equal(await storyPodcast({ id: "175839", format: "news" }, ORIGIN, loader), null);
  assert.equal(await storyPodcast({ id: "unknown", format: "podcasts" }, ORIGIN, loader), null);
});

test("التصنيفات: الأقسام بأولوية التنقل ثم الاسم، والسلاسل بترتيبها، والمتقاعدة منفصلة", () => {
  const payload = toMobileTaxonomy(
    {
      sections: [
        { slug: "news", name: "أخبار", shortName: "أخبار", navPriority: 3 },
        { slug: "technology", name: "تقنية وذكاء اصطناعي", shortName: "تقنية", color: "#123456", navPriority: 1 },
        { slug: "economy", name: "اقتصاد واستثمار", shortName: "اقتصاد", color: "#d99a18", navPriority: 1 },
        { slug: "health", name: "صحة", navPriority: 2 },
      ],
      series: [{ slug: "absat", name: "أبسط", description: "شرح", color: "#2d9a8c", archived: undefined }],
    },
    [{ slug: "qalu", name: "قالوا", description: "تصريحات", color: "#7c8aa5", archived: true }],
  );
  assert.equal(payload.contract, "mobile-taxonomy.v1");
  assert.deepEqual(payload.sections.map((item) => item.slug), ["economy", "technology", "health", "news"]);
  assert.deepEqual(payload.sections[2], { slug: "health", name: "صحة", shortName: "صحة", color: null });
  assert.deepEqual(payload.series, [{ slug: "absat", name: "أبسط", description: "شرح", color: "#2d9a8c" }]);
  assert.deepEqual(payload.archivedSeries, [{ slug: "qalu", name: "قالوا", description: "تصريحات", color: "#7c8aa5" }]);
});
