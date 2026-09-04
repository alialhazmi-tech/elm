import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";
import sharp from "sharp";

test("public sharing route serves JPEG, falls back to the brand, and hides unavailable stories", async () => {
  const directory = `tmp/sharing-route-test-${process.pid}`;
  await mkdir(directory, { recursive: true });
  try {
    await build({
      entryPoints: ["app/share-images/[filename]/route.ts"], outfile: `${directory}/route.mjs`, bundle: true, platform: "node", format: "esm", packages: "external",
      plugins: [{ name: "isolated-sharing", setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/content\/provider$/ }, () => ({ path: "provider", namespace: "test" }));
        builder.onResolve({ filter: /^@\/lib\/storage\/images$/ }, () => ({ path: "storage", namespace: "test" }));
        builder.onLoad({ filter: /.*/, namespace: "test" }, args => ({ contents: args.path === "provider"
          ? `export const seedContentProvider={getStory:async id=>id==='published'?{image:'/uploads/621a297f-10bd-40a5-87ee-67e0a54b5c28.webp'}:id==='broken'?{image:'/uploads/721a297f-10bd-40a5-87ee-67e0a54b5c28.webp'}:null};`
          : `export async function getStoredImage(name){globalThis.__shareReads++;if(name.startsWith('7'))throw new Error('missing');return {bytes:globalThis.__shareFixture};}`, loader: "js" }));
      } }],
    });
    globalThis.__shareFixture = await sharp({ create: { width: 1000, height: 600, channels: 3, background: "red" } }).webp().toBuffer();
    globalThis.__shareReads = 0;
    const { GET } = await import(`../${directory}/route.mjs`);
    const request = id => GET(new Request(`https://test.invalid/share-images/${id}.jpg`), { params: Promise.resolve({ filename: `${id}.jpg` }) });
    const photo = await request('published');
    assert.equal(photo.status, 200);
    assert.equal(photo.headers.get('Content-Type'), 'image/jpeg');
    const bytes = Buffer.from(await photo.arrayBuffer());
    const decoded = await sharp(bytes).metadata();
    assert.equal(decoded.format, 'jpeg');
    assert.equal(decoded.width, 1200); assert.equal(decoded.height, 630);
    assert.equal(Number(photo.headers.get('Content-Length')), bytes.length);
    await request('published');
    assert.equal(globalThis.__shareReads, 1);
    const fallback = await request('broken');
    assert.equal(fallback.status, 200);
    assert.equal(fallback.headers.get('Cache-Control'), 'public, max-age=60');
    const fallbackBytes = Buffer.from(await fallback.arrayBuffer());
    assert.equal((await sharp(fallbackBytes).metadata()).format, 'jpeg');
    assert.notDeepEqual(fallbackBytes, bytes);
    for (const id of ['missing', 'draft', '../secret']) assert.equal((await request(id)).status, 404);
  } finally {
    delete globalThis.__shareFixture;
    delete globalThis.__shareReads;
    await rm(directory, { recursive: true, force: true });
  }
});
