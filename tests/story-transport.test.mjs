import assert from "node:assert/strict";
import test from "node:test";

import { newSaveId, saveStory, scheduleStory, transitionStory, TRANSPORT_TIMEOUT_MS } from "../lib/tahrir/client/story-transport.ts";

test("النقل يرسل JSON بمهلة 15 ثانية وexpectedVersion ويعيد نتيجة منمّطة", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    if (url === "/api/tahrir/story") return Response.json({ id: "s1", version: 3, status: "draft", revisionOf: null, slug: "a", section: "news" });
    if (url.endsWith("/publish")) return Response.json({ error: "ممنوع النشر", blocking: ["X-1"] }, { status: 422 });
    if (url.endsWith("/schedule")) return new Response("not json", { status: 500 });
    return Response.json({ version: 4 });
  };
  try {
    assert.equal(TRANSPORT_TIMEOUT_MS, 15_000);
    const saved = await saveStory({ id: "temp", expectedVersion: 2, title: "ع" });
    assert.deepEqual(saved, { ok: true, data: { id: "s1", version: 3, status: "draft", revisionOf: null, slug: "a", section: "news" } });
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers["Content-Type"], "application/json");
    assert.ok(calls[0].init.signal instanceof AbortSignal);
    assert.equal(calls[0].body.expectedVersion, 2);
    assert.equal(calls[0].body.id, "temp");

    const rejected = await transitionStory("publish", { id: "s1", expectedVersion: 3 });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.status, 422);
    assert.equal(rejected.error, "ممنوع النشر");
    assert.deepEqual(rejected.body.blocking, ["X-1"]);

    const broken = await scheduleStory({ id: "s1", expectedVersion: 3, scheduledAt: "2026-09-09T11:30:00.000Z" });
    assert.equal(broken.ok, false);
    assert.equal(broken.status, 500);
    assert.equal(broken.error, "تعذرت الجدولة.");
    assert.equal(calls.at(-1).url, "/api/tahrir/story/schedule");

    const submitted = await transitionStory("submit", { id: "s1", expectedVersion: 3 });
    assert.deepEqual(submitted, { ok: true, data: { version: 4 } });
  } finally {
    globalThis.fetch = original;
  }
});

test("انقطاع الشبكة والمهلة يعيدان فشلًا بلا استثناء، والرد بلا هوية يُرفض", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    const offline = await saveStory({ id: "x", expectedVersion: 0 });
    assert.equal(offline.ok, false); assert.equal(offline.status, 0); assert.equal(offline.timedOut, false);

    globalThis.fetch = async () => { const error = new Error("timeout"); error.name = "TimeoutError"; throw error; };
    const late = await saveStory({ id: "x", expectedVersion: 0 });
    assert.equal(late.ok, false); assert.equal(late.timedOut, true);

    globalThis.fetch = async () => Response.json({ ok: true });
    const incomplete = await saveStory({ id: "x", expectedVersion: 0 });
    assert.equal(incomplete.ok, false);
    assert.match(incomplete.error, /تعذر الحفظ/);

    assert.match(newSaveId(), /^[0-9a-f-]{36}$/);
    assert.notEqual(newSaveId(), newSaveId());
  } finally {
    globalThis.fetch = original;
  }
});
