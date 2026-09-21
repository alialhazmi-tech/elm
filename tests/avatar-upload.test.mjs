import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import sharp from "sharp";
import { prepareAvatarUpload, saveAvatarRequest } from "../lib/avatar-client.ts";
import { putStoredImage } from "../lib/storage/images.ts";

test("avatar rejects HTML failures and malformed successes without showing JSON parser errors", async (t) => {
  for (const [status, body] of [[524, "<!DOCTYPE html><title>Timeout</title>"], [200, "<!DOCTYPE html>"], [200, '{"ok":true}']]) {
    t.mock.method(globalThis, "fetch", async () => new Response(body, { status }));
    await assert.rejects(saveAvatarRequest("/avatar"), error => /تعذر/.test(error.message) && !/JSON|Unexpected/.test(error.message));
    t.mock.restoreAll();
  }
});

test("avatar upload and removal require a confirmed result and preserve server validation messages", async (t) => {
  const file = new File(["image"], "avatar.webp", { type: "image/webp" });
  t.mock.method(globalThis, "fetch", async (_, options) => {
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("file").name, "avatar.webp");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ ok: true, image: "/uploads/avatar.webp" });
  });
  assert.equal(await saveAvatarRequest("/avatar", file), "/uploads/avatar.webp");
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async (_, options) => {
    assert.equal(options.method, "DELETE");
    assert.equal(options.body, undefined);
    return Response.json({ ok: true, image: null });
  });
  assert.equal(await saveAvatarRequest("/avatar"), null);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "محاولات كثيرة" }, { status: 429 }));
  await assert.rejects(saveAvatarRequest("/avatar", file), /محاولات كثيرة/);
});

test("stalled browser upload is aborted at 30 seconds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal;
  t.mock.method(globalThis, "fetch", async (_, options) => new Promise((_, reject) => {
    signal = options.signal;
    signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  }));
  const pending = saveAvatarRequest("/avatar");
  const rejection = assert.rejects(pending, /حدّث الصفحة للتحقق/);
  t.mock.timers.tick(30_000);
  await rejection;
  assert.equal(signal.aborted, true);
});

test("invalid avatar files are rejected before browser decoding", async () => {
  await assert.rejects(prepareAvatarUpload(new File(["svg"], "avatar.svg", { type: "image/svg+xml" })), /JPG/);
  await assert.rejects(prepareAvatarUpload(new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })), /4/);
});

test("storage deadline cancels both a stalled upload and stalled verification", async () => {
  let stage = "put";
  let requests = [];
  const server = createServer((req, res) => {
    requests.push(req.method);
    req.resume();
    if (stage === "head" && req.method === "PUT") {
      res.writeHead(200, { etag: '"fixture"' });
      res.end();
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const variables = {
    AWS_ENDPOINT_URL: `http://127.0.0.1:${server.address().port}`,
    AWS_S3_BUCKET_NAME: "fixture", AWS_ACCESS_KEY_ID: "fixture",
    AWS_SECRET_ACCESS_KEY: "fixture", AWS_DEFAULT_REGION: "auto",
  };
  const original = Object.fromEntries(Object.keys(variables).map(key => [key, process.env[key]]));
  Object.assign(process.env, variables);
  try {
    for (stage of ["put", "head"]) {
      requests = [];
      const started = performance.now();
      await assert.rejects(putStoredImage({ filename: "47ffde49-afc4-499d-b241-f5719ee33520.webp", body: new Uint8Array([1, 2]), contentType: "image/webp", signal: AbortSignal.timeout(300) }));
      assert.ok(performance.now() - started < 2_000);
      assert.deepEqual(requests, stage === "put" ? ["PUT"] : ["PUT", "HEAD"]);
    }
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test("multipart avatar decoding retains square WebP output and stops stalled input", async (t) => {
  const directory = `tmp/avatar-test-${process.pid}`;
  await mkdir(directory, { recursive: true });
  try {
    await build({ entryPoints: ["lib/storage/avatar.ts"], outfile: `${directory}/avatar.mjs`, bundle: true, platform: "node", format: "esm", packages: "external" });
    const { readAvatarFile, prepareAvatar } = await import(`../${directory}/avatar.mjs`);
    const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#25457a" } }).png().toBuffer();
    const body = new FormData();
    body.set("file", new File([png], "photo.png", { type: "image/png" }));
    const file = await readAvatarFile(new Request("http://local/avatar", { method: "POST", body }));
    const metadata = await sharp(await prepareAvatar(file)).metadata();
    assert.equal(metadata.width, 384);
    assert.equal(metadata.height, 384);
    assert.equal(metadata.format, "webp");
    const controller = new AbortController();
    t.mock.method(AbortSignal, "timeout", () => controller.signal);
    let cancelled = false;
    const stalled = new Request("http://local/avatar", { method: "POST", duplex: "half", body: new ReadableStream({ cancel() { cancelled = true; } }) });
    const pending = readAvatarFile(stalled);
    const rejection = assert.rejects(pending, error => error.status === 408);
    controller.abort();
    await rejection;
    assert.equal(cancelled, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
