import assert from "node:assert/strict";
import test from "node:test";
import { createViewerStore } from "../lib/membership/viewer-store.ts";

const member = { name: "قارئ تجريبي", emailVerified: true };
const editor = { name: "محرر تجريبي" };
const signedIn = { member, editor: null };
const guest = { member: null, editor: null };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test("header remounts reuse the identity and concurrent navigation shares one request", async () => {
  let calls = 0, clock = 1000;
  const request = deferred();
  const store = createViewerStore({ now: () => clock, fetcher: async () => { calls++; return request.promise; } });
  const first = store.refresh();
  const unsubscribe = store.subscribe(() => {});
  unsubscribe();
  const second = store.refresh();
  assert.equal(calls, 1);
  request.resolve(Response.json(signedIn));
  await Promise.all([first, second]);
  const snapshot = store.getSnapshot();
  for (let page = 0; page < 8; page++) {
    clock += 1000;
    await store.refresh();
    assert.equal(store.getSnapshot(), snapshot);
  }
  assert.equal(calls, 1);
  assert.equal(store.getServerSnapshot().viewer, null, "SSR cannot expose another user's identity");
});

test("transient HTTP, network and malformed responses retain the confirmed identity", async () => {
  let response = () => Response.json(signedIn);
  const updates = [];
  const store = createViewerStore({ fetcher: async () => response(), onViewer: viewer => updates.push(viewer) });
  await store.refresh();
  for (response of [
    () => new Response("unavailable", { status: 503 }),
    () => { throw new Error("offline"); },
    () => new Response("invalid json"),
    () => Response.json({}),
    () => Response.json({ member: { name: 123 }, editor: null }),
  ]) {
    await store.refresh(true);
    assert.deepEqual(store.getSnapshot(), { viewer: signedIn, error: true });
    assert.ok(updates.every(viewer => viewer.member));
  }
  response = () => Response.json(guest);
  await store.refresh(true);
  assert.deepEqual(store.getSnapshot(), { viewer: guest, error: false }, "confirmed logout clears identity");
});

test("initial failure remains unknown and retries recover without showing a confirmed guest", async () => {
  let clock = 0, calls = 0;
  const store = createViewerStore({ now: () => clock, fetcher: async () => {
    calls++;
    return calls === 1 ? new Response(null, { status: 503 }) : Response.json(signedIn);
  } });
  await store.refresh();
  assert.deepEqual(store.getSnapshot(), { viewer: null, error: true });
  await store.refresh();
  assert.equal(calls, 1, "rapid navigation does not retry a failed provider repeatedly");
  clock = 5000;
  await store.refresh();
  assert.deepEqual(store.getSnapshot(), { viewer: signedIn, error: false });
});

test("stale identity refreshes once in the background and profile refresh bypasses freshness", async () => {
  let clock = 0, calls = 0;
  let response = Response.json(signedIn);
  const store = createViewerStore({ now: () => clock, fetcher: async () => { calls++; return response; } });
  await store.refresh();
  clock = 60000;
  const pending = deferred(); response = pending.promise;
  const refresh = store.refresh();
  assert.equal(store.getSnapshot().viewer.member.name, member.name);
  pending.resolve(Response.json({ member: { ...member, name: "اسم محدّث" }, editor: null }));
  await refresh;
  assert.equal(calls, 2);
  response = Response.json({ member: { ...member, image: "/avatar.png" }, editor: null });
  await store.refresh(true);
  assert.equal(store.getSnapshot().viewer.member.image, "/avatar.png");
});

test("logout and session invalidation prevent an older request from restoring the previous account", async () => {
  let response = Response.json({ member, editor });
  const store = createViewerStore({ fetcher: async () => response });
  await store.refresh();
  const pending = deferred(); response = pending.promise;
  const old = store.refresh(true);
  store.removeIdentity("member");
  pending.resolve(Response.json({ member, editor }));
  await old;
  assert.deepEqual(store.getSnapshot().viewer, { member: null, editor });
  store.removeIdentity("editor");
  assert.deepEqual(store.getSnapshot().viewer, guest);
  response = Response.json(signedIn);
  store.invalidate();
  await store.refresh();
  assert.deepEqual(store.getSnapshot().viewer, signedIn);
});
