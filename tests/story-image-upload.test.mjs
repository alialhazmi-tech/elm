import assert from "node:assert/strict";
import test from "node:test";
import { uploadStoryImageFile } from "../lib/story-image-upload.ts";

const url = "/uploads/9e33792c-7cd4-4b2b-8399-a50202982068.png";
const file = new File([new Uint8Array([137, 80, 78, 71, 1, 2])], "إنفوجرافيك.png", { type: "image/png" });

function transport(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "XMLHttpRequest");
  const calls = [];
  class Request {
    upload = {};
    responseURL = "https://alelm.net/api/tahrir/media";
    constructor() { calls.push(this); }
    open(method, endpoint) { this.method = method; this.endpoint = endpoint; }
    send(body) { this.body = body; }
    respond(status, body) { this.status = status; this.responseText = body; this.onload(); }
  }
  Object.defineProperty(globalThis, "XMLHttpRequest", { configurable: true, value: Request });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "XMLHttpRequest", previous);
    else delete globalThis.XMLHttpRequest;
  });
  return calls;
}

test("editor sends original bytes and filename; sending 100% is not success until storage confirms", async (t) => {
  const calls = transport(t);
  const progress = [];
  let done = false;
  const pending = uploadStoryImageFile(file, n => progress.push(n)).then(result => { done = true; return result; });
  const request = calls[0];
  assert.equal(request.method, "POST");
  assert.equal(request.endpoint, "/api/tahrir/media");
  const sent = request.body.get("file");
  assert.equal(sent.name, file.name);
  assert.deepEqual(await sent.arrayBuffer(), await file.arrayBuffer());
  request.upload.onprogress({lengthComputable: true, loaded: 50, total: 100});
  request.upload.onprogress({lengthComputable: true, loaded: 100, total: 100});
  request.upload.onload();
  await Promise.resolve();
  assert.equal(done, false);
  assert.deepEqual(progress, [50, 100, null]);
  request.respond(200, JSON.stringify({ok:true, url}));
  assert.deepEqual(await pending, {url});
});

test("HTML proxy failures, login expiration, permission denial and oversized requests are actionable", async (t) => {
  const calls = transport(t);
  for (const [status, body, message] of [
    [520, "<!DOCTYPE html><html>Cloudflare</html>", /على الخادم/],
    [401, "", /انتهت الجلسة/],
    [413, "", /8 ميغابايت/],
    [403, JSON.stringify({error:"ليست لديك صلاحية هذا الإجراء."}), /صلاحية/],
  ]) {
    const pending = uploadStoryImageFile(file, () => {});
    const rejected = assert.rejects(pending, message);
    calls.at(-1).respond(status, body);
    await rejected;
  }
});

test("invalid success responses never replace the selected image", async (t) => {
  const calls = transport(t);
  for (const body of ["<html>login</html>", '{"ok":true}', JSON.stringify({ok:true,url:"https://untrusted.test/image.png"}), JSON.stringify({url})]) {
    const pending = uploadStoryImageFile(file, () => {});
    const rejected = assert.rejects(pending, /تأكيد حفظ الصورة/);
    calls.at(-1).respond(200, body);
    await rejected;
  }
});

test("network failure, timeout and cancellation settle; the same file can be retried", async (t) => {
  const calls = transport(t);
  for (const [event, message] of [["onerror", /انقطع الاتصال/], ["ontimeout", /انتهت مهلة/], ["onabort", /أُلغي/]]) {
    const pending = uploadStoryImageFile(file, () => {});
    const rejected = assert.rejects(pending, message);
    assert.equal(calls.at(-1).timeout, 90_000);
    calls.at(-1)[event]();
    await rejected;
  }
  const retried = uploadStoryImageFile(file, () => {});
  calls.at(-1).respond(200, JSON.stringify({ok:true,url}));
  assert.deepEqual(await retried, {url});
});

test("empty and oversized images are rejected before any request", async (t) => {
  const calls = transport(t);
  await assert.rejects(uploadStoryImageFile(new File([], "empty.png"), () => {}), /فارغة/);
  await assert.rejects(uploadStoryImageFile(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "big.png"), () => {}), /8 ميغابايت/);
  assert.equal(calls.length, 0);
});
