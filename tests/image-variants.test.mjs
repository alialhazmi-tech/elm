import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { imageVariantUrl, imageVariantSource, imageQualityForSource, publicImageSource } from '../lib/image-source.ts';
import imageVariantLoader from '../lib/image-variant-loader.ts';
import { createImageVariantCache, resizeEditorialImage } from '../lib/image-variants.ts';

const filename = '621a297f-10bd-40a5-87ee-67e0a54b5c28.webp';
test('variants normalize stored URLs and leave unsupported assets untouched', () => {
  const path = `/uploads/${filename}`;
  assert.equal(imageVariantUrl(path, 168), imageVariantUrl('https://alelm.net' + path, 168));
  assert.equal(new URL(imageVariantUrl(path, 170), 'https://alelm.net').searchParams.get('w'), '360');
  assert.equal(new URL(imageVariantUrl(path, 170, 72), 'https://alelm.net').searchParams.get('q'), '75');
  assert.equal(imageQualityForSource('/uploads/infographic.png', 60), 78);
  assert.equal(imageQualityForSource('/uploads/photo.webp', 60), 60);
  assert.equal(imageVariantLoader({ src: path, width: 1080, quality: 75 }), imageVariantUrl(path, 1080));
  assert.match(imageVariantLoader({ src: path, width: 1080, quality: 60 }), /q=60/);
  for (const name of ['صورة-الخبر.webp', 'صورة🌍.webp', 'صورة%20%26%2B%23.webp', 'literal%2520.webp', 'file%23name.webp']) {
    const url = new URL('https://dash.alelm.net/wp-content/uploads/' + name).href;
    const query = new URL(imageVariantUrl(url,168), 'https://alelm.net').searchParams.get('src');
    assert.deepEqual(imageVariantSource(query), {url});
  }
  for (const src of ['/brand/logo.png', 'https://example.com/a.jpg', 'https://dash.alelm.net/wp-content/uploads/animation.gif']) assert.equal(imageVariantUrl(src, 168), src);
  for (const src of ['http://127.0.0.1/a.jpg', 'https://dash.alelm.net.evil.test/wp-content/uploads/a.jpg', 'https://user:pass@dash.alelm.net/wp-content/uploads/a.jpg', 'https://dash.alelm.net/wp-content/uploads/../../admin', 'https://dash.alelm.net/wp-content/uploads/%2e%2e%2fa.jpg', 'https://dash.alelm.net/wp-content/uploads/file.php', 'https://dash.alelm.net:444/wp-content/uploads/a.jpg', '/uploads/../api/health', '/uploads/'+filename+'?x=1']) assert.equal(publicImageSource(src), null);
});

test('responsive versions preserve aspect ratio, rotate correctly and never enlarge originals', async () => {
  const original = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#aa6633' } }).png().toBuffer();
  const small = await resizeEditorialImage(original, 168);
  const m = await sharp(small).metadata();
  assert.deepEqual([m.width, m.height, m.format], [168, 126, 'webp']);
  assert.ok(small.length < original.length);
  const enlarged = await sharp(await resizeEditorialImage(original, 1920)).metadata();
  assert.deepEqual([enlarged.width, enlarged.height], [1200, 900]);
  const portrait = await sharp(original).withMetadata({orientation:6}).jpeg().toBuffer();
  const rotated = await sharp(await resizeEditorialImage(portrait, 168)).metadata();
  assert.deepEqual([rotated.width, rotated.height], [168, 224]);
  await assert.rejects(resizeEditorialImage(Buffer.from('not an image'), 168));
  await assert.rejects(resizeEditorialImage(new Uint8Array(8 * 1024 * 1024 + 1), 168), /too large/);
});

test('quality is bounded and changes the encoded size', async () => {
  const original = await sharp({ create: { width: 800, height: 450, channels: 3, background: '#aa6633' } }).png().toBuffer();
  const high = await resizeEditorialImage(original, 800, 78);
  const low = await resizeEditorialImage(original, 800, 60);
  assert.ok(low.length < high.length);
  assert.equal(imageQualityForSource('/uploads/photo.webp', 101), 78);
});

test('cache coalesces requests, bounds concurrent work and allows retries after failure', async () => {
  const cached = createImageVariantCache();
  let calls = 0, active = 0, peak = 0;
  const render = async () => {
    calls++; active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--; return Buffer.from('image');
  };
  const results = await Promise.all(Array.from({length:10},()=>cached('same',render)));
  assert.equal(calls, 1);
  assert.ok(results.every(result => result.equals(Buffer.from('image'))));
  await Promise.all(Array.from({length:10},(_,i)=>cached('different'+i,render)));
  assert.equal(peak, 2);
  await assert.rejects(cached('fail',async()=>{throw new Error('source unavailable')}));
  assert.deepEqual(await cached('fail',render), Buffer.from('image'));
});

test('saturated work queue falls back without starting more decoders', async () => {
  const cached = createImageVariantCache();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const work = Array.from({length:32}, (_,i)=>cached(String(i), async()=>{await gate; return Buffer.from('ok')}));
  assert.equal(await cached('overflow', async()=>{throw new Error('must not run')}), null);
  release();
  await Promise.all(work);
  assert.deepEqual(await cached('overflow', async()=>Buffer.from('ok')), Buffer.from('ok'));
});
