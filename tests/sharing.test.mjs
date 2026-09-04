import assert from "node:assert/strict";
import test from "node:test";
import { sharingMetadata, sharingOrigin } from "../lib/sharing.ts";

const env = { RAILWAY_PUBLIC_DOMAIN: "elm-preview.up.railway.app", NEXT_PUBLIC_SITE_URL: "https://alelm.net" };

test("share assets use the serving deployment instead of the legacy canonical site", () => {
  assert.equal(sharingOrigin(env), "https://elm-preview.up.railway.app");
  assert.equal(sharingOrigin({ ...env, SHARING_ORIGIN: "https://alelm.net/" }), "https://alelm.net");
  assert.equal(sharingOrigin({}), "https://elm-production-ea24.up.railway.app");
  assert.equal(sharingOrigin({ RAILWAY_PUBLIC_DOMAIN: "alelm.net", NEXT_PUBLIC_SITE_URL: "https://alelm.net" }), "https://elm-production-ea24.up.railway.app");
  assert.throws(() => sharingOrigin({ SHARING_ORIGIN: "javascript:alert(1)" }));
  const meta = sharingMetadata({ title: "العلم", description: "المعرفة وراء الخبر", path: "/" }, env);
  assert.equal(meta.openGraph.images[0].url, "https://elm-preview.up.railway.app/og.png");
  assert.equal(meta.twitter.images[0].url, meta.openGraph.images[0].url);
  assert.equal(meta.openGraph.images[0].width, 1200);
  assert.equal(meta.openGraph.images[0].height, 630);
});

test("article previews carry their own title, description, image, and encoded URL on both networks", () => {
  const input = { title: "عنوان الخبر", description: "وصف الخبر", path: "/health/123/خبر-عربي", image: "/uploads/photo.jpg", type: "article", publishedTime: "2026-09-04T00:00:00Z" };
  const meta = sharingMetadata(input, env);
  assert.equal(meta.openGraph.title, input.title);
  assert.equal(meta.twitter.title, input.title);
  assert.equal(meta.twitter.description, input.description);
  assert.equal(meta.openGraph.url, new URL(input.path, sharingOrigin(env)).href);
  assert.equal(meta.openGraph.images[0].url, "https://elm-preview.up.railway.app/uploads/photo.jpg");
  assert.equal(meta.openGraph.publishedTime, input.publishedTime);
  assert.equal(meta.openGraph.siteName, "العلم");
  assert.equal(meta.openGraph.locale, "ar_SA");
  assert.equal(meta.twitter.card, "summary_large_image");
});

test("external article photos are preserved and missing or unsafe photos use the brand card", () => {
  const input = { title: "خبر", description: "وصف", path: "/health/1/news" };
  assert.equal(sharingMetadata({ ...input, image: "https://dash.alelm.net/photo.jpg" }, env).openGraph.images[0].url, "https://dash.alelm.net/photo.jpg");
  for (const image of [undefined, "", "data:image/png;base64,AAA", "javascript:alert(1)", "https://user:password@example.test/photo.jpg"]) {
    const meta = sharingMetadata({ ...input, image }, env);
    assert.equal(meta.openGraph.images[0].url, "https://elm-preview.up.railway.app/og.png");
  }
});

test("article images have a JPEG sharing endpoint, dimensions and a source-specific cache key", () => {
  const input = { storyId: "264648", title: "خبر", description: "وصف", path: "/health/264648/news", image: "/uploads/photo.webp" };
  const meta = sharingMetadata(input, env);
  assert.match(meta.openGraph.images[0].url, /^https:\/\/elm-preview.up.railway.app\/share-images\/264648.jpg\?v=/);
  assert.equal(meta.openGraph.images[0].type, "image/jpeg");
  assert.equal(meta.openGraph.images[0].width, 1200);
  assert.equal(meta.openGraph.images[0].height, 630);
  assert.equal(meta.twitter.images[0].url, meta.openGraph.images[0].url);
  assert.notEqual(sharingMetadata({ ...input, image: "/uploads/updated.webp" }, env).openGraph.images[0].url, meta.openGraph.images[0].url);
  assert.equal(sharingMetadata({ ...input, image: undefined }, env).openGraph.images[0].url, "https://elm-preview.up.railway.app/og.png");
});
