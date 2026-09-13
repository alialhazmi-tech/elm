import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import path from "node:path";

const secret = "local-origin-runtime-fixture-secret-32";
const cronSecret = "local-origin-runtime-cron-fixture";
const trustedHeaders = { "x-alelm-origin-token": secret, "cf-connecting-ip": "203.0.113.8" };
async function withServer(enforced, configuredSecret, check) {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], {
    env: { ...process.env, DATABASE_URL: "", NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-gate", ORIGIN_AUTH_ENFORCE: enforced, ORIGIN_AUTH_SECRET: configuredSecret, CRON_SECRET: cronSecret },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout.on("data", data => { output += data; });
  server.stderr.on("data", data => { output += data; });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) break;
      if (output.includes("Ready in")) {
        try { await fetch(origin, { redirect: "manual", signal: AbortSignal.timeout(2000) }); ready = true; break; } catch { /* starting */ }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, output);
    await check((pathname, options = {}) => fetch(origin + pathname, { redirect: "manual", ...options }));
  } finally {
    if (server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
  }
}

await withServer("1", secret, async get => {
  for (const pathname of ["/", "/tahrir/login", "/api/viewer", "/_next/static/probe.js", "/api/webhooks/neon", "/api/health/private"]) {
    const response = await get(pathname, { headers: { host: "alelm.net", "x-forwarded-for": "127.0.0.1", "cf-connecting-ip": "203.0.113.8", "next-router-prefetch": "1" } });
    assert.equal(response.status, 403, pathname);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal((await get("/", { headers: { ...trustedHeaders, "x-alelm-origin-token": "wrong" } })).status, 403);
  assert.equal((await get("/", { headers: { "x-alelm-origin-token": secret } })).status, 403);
  const home = await get("/", { headers: trustedHeaders });
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-security-policy"), /script-src 'self' 'unsafe-inline'/);
  const publicHtml = await home.text();
  assert.ok(!publicHtml.includes(secret));
  const asset = publicHtml.match(/src="([^"]*\/_next\/static\/[^"]+\.js)"/)[1];
  assert.equal((await get(asset, { headers: trustedHeaders })).status, 200);
  assert.equal((await get(asset)).status, 403);
  const nonces = [];
  for (const pathname of ["/tahrir/login", "/tahrir/recover", "/tahrir/login"]) {
    const response = await get(pathname, { headers: { ...trustedHeaders, "x-nonce": "attacker", "content-security-policy": "script-src * 'unsafe-inline'" } });
    assert.equal(response.status, 200);
    const policy = response.headers.get("content-security-policy");
    const scripts = policy.split(";").map(s => s.trim()).find(s => s.startsWith("script-src "));
    assert.ok(!scripts.includes("'unsafe-inline'"));
    assert.match(policy, /script-src-attr 'none'/);
    const nonce = scripts.match(/'nonce-([^']+)'/)[1];
    nonces.push(nonce);
    const html = await response.text();
    assert.ok(html.includes(`nonce="${nonce}"`));
    assert.ok(!html.includes(secret));
    assert.ok(!policy.includes("attacker"));
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
  assert.equal(new Set(nonces).size, nonces.length);
  const health = await get("/api/health");
  assert.equal(health.status, 503); // Allowed through proxy; no database in this fixture.
  assert.deepEqual(await health.json(), { ok: false });
  assert.equal((await get("/api/health", { method: "POST" })).status, 403);
  assert.equal((await get("/api/tahrir/tick", { method: "POST" })).status, 403);
  assert.equal((await get("/api/tahrir/tick", { headers: { authorization: `Bearer ${cronSecret}` } })).status, 403);
  const tick = await get("/api/tahrir/tick", { method: "POST", headers: { authorization: `Bearer ${cronSecret}` } });
  assert.ok([200, 503].includes(tick.status));
  assert.equal(typeof (await tick.json()).ok, "boolean");
});
await withServer("1", "", async get => {
  assert.equal((await get("/")).status, 503);
  assert.equal((await get("/api/health")).status, 503);
});
await withServer("0", "", async get => {
  assert.equal((await get("/")).status, 200);
});
console.log("PASS: production runtime origin gate, trusted assets, spoof rejection, private fresh CSP nonces, narrow health/cron exceptions, fail-closed configuration and disabled rollout mode.");
