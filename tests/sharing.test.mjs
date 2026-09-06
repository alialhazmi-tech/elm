import assert from "node:assert/strict";
import test from "node:test";
import { sharingMetadata, sharingOrigin } from "../lib/sharing.ts";
import { refreshedShareUrl, sharingImageFit, SHARING_VERSION } from "../lib/sharing-contract.ts";

const env = { RAILWAY_PUBLIC_DOMAIN: "elm-preview.up.railway.app", NEXT_PUBLIC_SITE_URL: "https://alelm.net" };

test("public sharing stays on the custom domain even when Railway injects its service domain", () => {
  assert.equal(sharingOrigin(env), "https://alelm.net");
  assert.equal(sharingOrigin({ ...env, SHARING_ORIGIN: "https://alelm.net/" }), "https://alelm.net");
  assert.equal(sharingOrigin({}), "https://alelm.net");
  assert.equal(sharingOrigin({ RAILWAY_PUBLIC_DOMAIN: "elm-preview.up.railway.app" }), "https://alelm.net");
  assert.equal(sharingOrigin({ SHARING_ORIGIN: "  ", NEXT_PUBLIC_SITE_URL: "  " }), "https://alelm.net");
  assert.equal(sharingOrigin({ ...env, SHARING_ORIGIN: " https://preview.example.test/ " }), "https://preview.example.test");
  assert.equal(sharingOrigin({ NEXT_PUBLIC_SITE_URL: "https://public.example.test/" }), "https://public.example.test");
  assert.equal(sharingOrigin({ RAILWAY_PUBLIC_DOMAIN: "alelm.net", NEXT_PUBLIC_SITE_URL: "https://alelm.net" }), "https://alelm.net");
  assert.throws(() => sharingOrigin({ SHARING_ORIGIN: "javascript:alert(1)" }));
  const meta = sharingMetadata({ title: "العلم", description: "المعرفة وراء الخبر", path: "/" }, env);
  assert.equal(meta.openGraph.images[0].url, "https://alelm.net/brand/share.jpg?v=20260905-light");
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
  assert.equal(meta.openGraph.images[0].url, "https://alelm.net/uploads/photo.jpg");
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
    assert.equal(meta.openGraph.images[0].url, "https://alelm.net/brand/share.jpg?v=20260905-light");
  }
});

test("article images have a JPEG sharing endpoint, dimensions and a source-specific cache key", () => {
  const input = { storyId: "264648", title: "خبر", description: "وصف", path: "/health/264648/news", image: "/uploads/photo.webp" };
  const meta = sharingMetadata(input, env);
  assert.match(meta.openGraph.images[0].url, /^https:\/\/alelm.net\/share-images\/264648\.v[a-z0-9-]+\.jpg$/);
  assert.equal(meta.openGraph.images[0].type, "image/jpeg");
  assert.equal(meta.openGraph.images[0].width, 1200);
  assert.equal(meta.openGraph.images[0].height, 630);
  assert.equal(meta.twitter.images[0].url, meta.openGraph.images[0].url);
  assert.notEqual(sharingMetadata({ ...input, image: "/uploads/updated.webp" }, env).openGraph.images[0].url, meta.openGraph.images[0].url);
  assert.match(meta.openGraph.images[0].url, new RegExp(`\\.v${SHARING_VERSION}-cover-`));
  assert.equal(new URL(meta.openGraph.images[0].url).search, "", "image identity must survive removal of query parameters");
  assert.notEqual(new URL(sharingMetadata({ ...input, image: "/uploads/updated.webp" }, env).openGraph.images[0].url).pathname, new URL(meta.openGraph.images[0].url).pathname);
  assert.notEqual(sharingMetadata({ ...input, format: "infographics" }, env).openGraph.images[0].url, meta.openGraph.images[0].url);
  assert.equal(meta.openGraph.url, refreshedShareUrl(input.path, "https://alelm.net"));
  assert.equal(sharingMetadata({ ...input, image: undefined }, env).openGraph.images[0].url, "https://alelm.net/brand/share.jpg?v=20260905-light");
});

test("sharing paths bypass stale article redirects, retain tracking, and remain stable", () => {
  const url = refreshedShareUrl("/politics/id/عنوان?utm_source=x&xcard=old#section", "https://alelm.net");
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("utm_source"), "x");
  assert.equal(parsed.searchParams.has("xcard"), false);
  assert.equal(parsed.hash, "");
  assert.equal(parsed.pathname, `/share/id/${SHARING_VERSION}`);
  assert.equal(refreshedShareUrl(url), url);
  assert.equal(refreshedShareUrl(`/share/id/20260906-1`, 'https://alelm.net'), `https://alelm.net/share/id/${SHARING_VERSION}`);
});

test("photo cards fill the canvas while infographic and slide cards preserve all content", () => {
  for (const story of [{}, { format: "news" }, { format: "reports" }, { format: "videos" }]) assert.equal(sharingImageFit(story), "cover");
  for (const story of [{ format: "infographics" }, { section: "infographics", format: "news" }, { format: "jakalelm" }]) assert.equal(sharingImageFit(story), "contain");
});
