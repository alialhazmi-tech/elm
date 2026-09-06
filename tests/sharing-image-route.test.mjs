import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";
import sharp from "sharp";

test("sharing route fills photos, preserves infographics, retries failures, and hides unavailable stories", async () => {
  const directory = `tmp/sharing-route-test-${process.pid}`;
  await mkdir(directory, { recursive: true });
  try {
    await build({
      entryPoints: ["app/share-images/[filename]/route.ts"], outfile: `${directory}/route.mjs`, bundle: true, platform: "node", format: "esm", packages: "external",
      plugins: [{ name: "isolated-sharing", setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/content\/provider$/ }, () => ({ path: "provider", namespace: "test" }));
        builder.onResolve({ filter: /^@\/lib\/storage\/images$/ }, () => ({ path: "storage", namespace: "test" }));
        builder.onLoad({ filter: /.*/, namespace: "test" }, args => ({ contents: args.path === "provider"
          ? `export const seedContentProvider={getStory:async id=>id==='published'?{image:'/uploads/621a297f-10bd-40a5-87ee-67e0a54b5c28.webp'}:id==='infographic'?{format:'infographics',image:'/uploads/621a297f-10bd-40a5-87ee-67e0a54b5c28.webp'}:id==='no-image'?{}:id==='unsupported'?{image:'https://example.test/photo.jpg'}:id==='broken'?{image:'/uploads/721a297f-10bd-40a5-87ee-67e0a54b5c28.webp'}:null};`
          : `export async function getStoredImage(name){globalThis.__shareReads++;if(name.startsWith('7')&&globalThis.__shareBroken)throw new Error('missing');return {bytes:globalThis.__shareFixture};}`, loader: "js" }));
      } }],
    });
    globalThis.__shareFixture = await sharp({ create: { width: 1000, height: 600, channels: 3, background: "red" } }).webp().toBuffer();
    globalThis.__shareReads = 0;
    globalThis.__shareBroken = true;
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
    const versioned = await request('published.v20260906-3-cover-abc123');
    assert.equal(versioned.status, 200);
    assert.deepEqual(Buffer.from(await versioned.arrayBuffer()), bytes, 'versioned filenames and legacy URLs return the same photo');
    assert.equal(globalThis.__shareReads, 1, 'URL versions reuse the source cache');
    const graphicBytes = Buffer.from(await (await request('infographic')).arrayBuffer());
    assert.notDeepEqual(graphicBytes, bytes, 'same source must have a separate cache entry per crop policy');
    const corner = async buffer => [...(await sharp(buffer).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer())];
    assert.ok((await corner(bytes))[1] < 20, 'photo fills the canvas');
    assert.ok((await corner(graphicBytes)).every(c => c > 230), 'infographic fits inside the canvas');
    const failed = await request('broken');
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get('Cache-Control'), 'no-store');
    assert.equal(failed.headers.get('Retry-After'), '60');
    assert.equal((await failed.arrayBuffer()).byteLength, 0, 'transient failure must not deliver a logo');
    globalThis.__shareBroken = false;
    const recovered = await request('broken');
    assert.equal(recovered.status, 200);
    assert.deepEqual(Buffer.from(await recovered.arrayBuffer()), bytes);
    assert.equal((await request('unsupported')).status, 503);
    const fallback = await request('no-image');
    assert.equal(fallback.status, 200);
    assert.equal(fallback.headers.get('Cache-Control'), 'public, max-age=60');
    const fallbackBytes = Buffer.from(await fallback.arrayBuffer());
    assert.equal((await sharp(fallbackBytes).metadata()).format, 'jpeg');
    assert.notDeepEqual(fallbackBytes, bytes);
    for (const id of ['missing', 'draft', '../secret', 'draft.v20260906-3-cover-abc123', 'published.v', 'published.vbad_version', 'published.v' + 'a'.repeat(65)]) assert.equal((await request(id)).status, 404);
  } finally {
    delete globalThis.__shareFixture;
    delete globalThis.__shareReads;
    delete globalThis.__shareBroken;
    await rm(directory, { recursive: true, force: true });
  }
});
