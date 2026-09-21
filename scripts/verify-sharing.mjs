import assert from "node:assert/strict";
import sharp from "sharp";

const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base)) throw new Error("Usage: node scripts/verify-sharing.mjs https://your-public-site");
const origin = new URL(base).origin;
const home = await fetch(origin, { signal: AbortSignal.timeout(20000) });
assert.equal(home.status, 200);
const homeHtml = await home.text();
const article = process.argv[3] ?? [...homeHtml.matchAll(/href="([^"?#]+)"/g)].map(x => x[1]).find(x => /^\/[^/]+\/(?:\d+|[a-f0-9-]{36})\//i.test(x));
assert.ok(article, "Homepage must contain a real article to verify");
const images = new Set();
const results = [];
let brandBytes;
for (const agent of ["WhatsApp/2.24.1", "facebookexternalhit/1.1", "Twitterbot/1.0"]) {
  for (const path of ["/", article, "/politics", "/series", "/series/absat"]) {
    const response = await fetch(new URL(path, origin), { headers: { "User-Agent": agent }, signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, `${path}: page unavailable`);
    const html = await response.text();
    const head = html.split("</head>")[0];
    const meta = new Map([...head.matchAll(/<meta (?:property|name)="((?:og|twitter):[^"]+)" content="([^"]*)"/g)].map(x => [x[1], x[2].replaceAll("&amp;", "&")]));
    for (const key of ["og:title", "og:description", "og:url", "og:image", "og:site_name", "og:locale", "twitter:title", "twitter:description", "twitter:image", "twitter:card"]) assert.ok(meta.get(key), `${agent} ${path}: missing ${key} in head`);
    assert.equal(meta.get("og:title"), meta.get("twitter:title"));
    assert.equal(meta.get("og:description"), meta.get("twitter:description"));
    assert.equal(meta.get("og:image"), meta.get("twitter:image"));
    assert.equal(new URL(meta.get("og:url")).origin, origin, "Sharing URL points to another deployment");
    assert.equal(meta.get("og:locale"), "ar_SA");
    assert.equal(meta.get("twitter:card"), "summary_large_image");
    const image = meta.get("og:image");
    const imageKey = `${agent}:${image}`;
    if (!images.has(imageKey)) {
      const asset = await fetch(image, { headers: { "User-Agent": agent }, signal: AbortSignal.timeout(20000) });
      assert.equal(asset.status, 200, "Sharing image unavailable");
      assert.match(asset.headers.get("content-type") ?? "", /^image\/(jpeg|png)(?:;|$)/, "Sharing requires a JPEG or PNG asset");
      const bytes = Buffer.from(await asset.arrayBuffer());
      if (new URL(image).pathname.startsWith("/share-images/")) {
        brandBytes ??= Buffer.from(await (await fetch(new URL("/brand/share.jpg", origin))).arrayBuffer());
        assert.ok(!bytes.equals(brandBytes), "An article image endpoint must not silently serve the brand card");
      }
      const decoded = await sharp(bytes).metadata();
      assert.ok(bytes.byteLength > 100 && bytes.byteLength < 1024 * 1024, "Sharing image must be non-empty and below 1 MB");
      assert.ok(["jpeg", "png"].includes(decoded.format), "Actual image encoding must match a supported sharing format");
      assert.equal(decoded.width, Number(meta.get("og:image:width")), "Declared image width must match actual bytes");
      assert.equal(decoded.height, Number(meta.get("og:image:height")), "Declared image height must match actual bytes");
      assert.equal(asset.headers.get("content-type")?.split(";")[0], meta.get("og:image:type"));
      images.add(imageKey);
    }
    results.push({ agent, path, title: meta.get("og:title"), image });
  }
}
assert.notEqual(results[0].title, results[1].title, "Article must not inherit the homepage title");
console.log(JSON.stringify({ checked: results.length, imageAssets: images.size, results }, null, 2));
