import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { MAX_SHARE_SOURCE_BYTES, readSharingResponse, sharingImageSource, sharingJpeg } from "../lib/sharing-image.ts";

test("sharing accepts only stored UUID images and the known legacy media path", () => {
  const filename = "621a297f-10bd-40a5-87ee-67e0a54b5c28.webp";
  assert.deepEqual(sharingImageSource(`/uploads/${filename}`), { filename });
  assert.deepEqual(sharingImageSource("https://dash.alelm.net/wp-content/uploads/photo.webp"), { url: "https://dash.alelm.net/wp-content/uploads/photo.webp" });
  for (const source of ["http://127.0.0.1/a", "https://dash.alelm.net.evil.test/wp-content/uploads/a", "https://user:pass@dash.alelm.net/wp-content/uploads/a", "https://dash.alelm.net/admin", "https://dash.alelm.net/wp-content/uploads/../../admin", "https://dash.alelm.net:444/wp-content/uploads/a", "/uploads/../api/health", "data:image/png;base64,AAAA"]) assert.equal(sharingImageSource(source), null);
});

test("WebP converts to a bounded JPEG canvas without cropping tall editorial images", async () => {
  const input = await sharp({ create: { width: 300, height: 1000, channels: 3, background: "#ff0000" } }).webp().toBuffer();
  const output = await sharingJpeg(input);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.ok(output.byteLength < 300_000);
  const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
  assert.ok(pixel(600, 10)[0] > 240 && pixel(600, 10)[1] < 20);
  assert.ok(pixel(10, 300).every(channel => channel > 235));
  await assert.rejects(sharingJpeg(Buffer.from("not an image")));
  await assert.rejects(sharingJpeg(new Uint8Array(MAX_SHARE_SOURCE_BYTES + 1)), /too large/);
});

test("remote images reject HTML, errors and oversized streamed bodies", async () => {
  await assert.rejects(readSharingResponse(new Response("html", { headers: { "Content-Type": "text/html" } })), /unavailable/);
  await assert.rejects(readSharingResponse(new Response(null, { status: 404 })), /unavailable/);
  await assert.rejects(readSharingResponse(new Response(new Uint8Array(MAX_SHARE_SOURCE_BYTES + 1), { headers: { "Content-Type": "image/webp" } })), /too large/);
  assert.deepEqual(await readSharingResponse(new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } })), Buffer.from([1, 2, 3]));
});
