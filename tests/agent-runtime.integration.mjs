import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { request } from "node:http";
import path from "node:path";

async function withServer(enforced, check) {
  const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening");
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], {
    env: { ...process.env, DATABASE_URL: "", NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-gate",
      ORIGIN_AUTH_ENFORCE: enforced ? "1" : "0", ORIGIN_AUTH_SECRET: "agent-runtime-local-origin-secret-32" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = ""; server.stdout.on("data", data => { output += data; }); server.stderr.on("data", data => { output += data; });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) break;
      if (output.includes("Ready in")) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, output);
    await check((pathname, headers = {}, method = "GET") => fetch(origin + pathname, { redirect: "manual", headers, method }), origin);
  } finally {
    if (server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); }
  }
}

await withServer(false, async (get, origin) => {
  for (const accept of ["text/html", "*/*", "text/markdown;q=0", "text/html,text/markdown;q=0.5"]) {
    const html = await get("/", { accept });
    assert.equal(html.status, 200); assert.match(html.headers.get("content-type"), /text\/html/);
    assert.match(html.headers.get("vary"), /\bAccept\b/i);
    assert.match(html.headers.get("link"), /<\/.well-known\/api-catalog>; rel="api-catalog"/);
  }
  for (const method of ["GET", "HEAD"]) {
    const md = await get("/", { accept: "text/markdown" }, method);
    assert.equal(md.status, 503, "A disconnected database must not become a successful demo Markdown response");
    assert.match(md.headers.get("content-type"), /text\/markdown/);
    assert.match(md.headers.get("vary"), /\bAccept\b/i);
    assert.match(md.headers.get("cache-control"), /no-store/);
    assert.equal(md.headers.get("retry-after"), "60");
  }
  const html = await get("/"); assert.equal(html.status, 200); assert.match(html.headers.get("content-type"), /text\/html/);
  const spoofed = await get("/", { accept: "text/html", "x-alelm-markdown-path": "/tahrir/editor/123" });
  assert.equal(spoofed.status, 200); assert.match(spoofed.headers.get("content-type"), /text\/html/);
  const prefetchHeaders = { accept: "text/x-component", rsc: "1", "next-router-prefetch": "1" };
  let prefetch = await get("/", prefetchHeaders);
  if (prefetch.status === 307) {
    const target = new URL(prefetch.headers.get("location"), origin);
    assert.ok(target.searchParams.has("_rsc"), "Next may normalize its RSC cache key");
    prefetch = await get(target.pathname + target.search, prefetchHeaders);
  }
  assert.equal(prefetch.status, 200); assert.doesNotMatch(prefetch.headers.get("content-type"), /text\/markdown/);
  const direct = await get("/content.md", { "x-alelm-markdown-path": "/", accept: "text/markdown" });
  assert.equal(direct.status, 404, "Client-supplied rewrite markers must be stripped");
  for (const value of ["https://example.com/", "/tahrir/editor/123", "/api/me"]) {
    assert.equal((await get(`/content.md?path=${encodeURIComponent(value)}`)).status, 404);
  }
  const cms = await get("/tahrir/login", { accept: "text/markdown" });
  assert.equal(cms.status, 200); assert.match(cms.headers.get("content-type"), /text\/html/);
  const protectedApi = await get("/api/me/profile", { accept: "text/markdown" });
  assert.equal(protectedApi.status, 401);
  const www = await new Promise((resolve, reject) => {
    const req = request(origin + "/?source=agent", { headers: { host: "www.alelm.net", accept: "text/markdown" } }, response => {
      response.resume(); response.on("end", () => resolve(response));
    });
    req.on("error", reject); req.end();
  });
  assert.equal(www.statusCode, 308); assert.equal(new URL(www.headers.location).href, "https://alelm.net/?source=agent");
  for (const [url, contentType] of [["/.well-known/api-catalog", /application\/linkset\+json/], ["/openapi.json", /application\/json/],
    ["/docs/content-api.md", /text\/markdown/], ["/.well-known/agent-skills/index.json", /application\/json/],
    ["/.well-known/agent-skills/read-alelm/SKILL.md", /text\/markdown/]]) {
    const response = await get(url); assert.equal(response.status, 200, url); assert.match(response.headers.get("content-type"), contentType);
  }
  const catalog = await (await get("/.well-known/api-catalog")).json();
  assert.equal((await get(new URL(catalog.linkset[0].anchor).pathname)).status, 200);
  const robots = await (await get("/robots.txt")).text();
  assert.match(robots, /Content-Signal: ai-train=yes, search=yes, ai-input=yes/);
  assert.equal((await get("/api/content/v1/articles/123", {}, "POST")).status, 405);
  const rpcHeaders = { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-11-25" };
  const rpc = (body, headers = {}) => fetch(origin + "/mcp", { method: "POST", headers: { ...rpcHeaders, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const initialize = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "http-test", version: "1" } } };
  const initialized = await rpc(initialize);
  assert.equal(initialized.status, 200); assert.equal(initialized.headers.get("mcp-session-id"), null);
  assert.equal(initialized.headers.get("cache-control"), "no-store");
  assert.equal((await initialized.json()).result.serverInfo.name, "net.alelm/public-content");
  const toolList = await (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" })).json();
  assert.deepEqual(toolList.result.tools.map(tool => tool.name).sort(), ["read_article", "search_articles"]);
  const failure = await (await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "read_article", arguments: { id: "123" } } })).json();
  assert.equal(failure.result.isError, true); assert.doesNotMatch(JSON.stringify(failure), /postgres|DATABASE_URL|select /);
  assert.equal((await rpc(initialize, { origin: "https://attacker.example" })).status, 403);
  assert.equal((await rpc([initialize, initialize])).status, 400);
  assert.equal((await rpc("{" )).status, 400);
  assert.equal((await rpc(" ".repeat(16_385))).status, 413);
  assert.equal((await get("/mcp")).status, 405);
  assert.equal((await get("/mcp", {}, "DELETE")).status, 405);
  const card = await get("/mcp/server-card");
  assert.equal(card.status, 200); assert.match(card.headers.get("content-type"), /application\/mcp-server-card\+json/);
  assert.equal(card.headers.get("access-control-allow-origin"), "*");
  const aiCatalog = await get("/.well-known/ai-catalog.json");
  assert.equal(aiCatalog.status, 200); assert.equal(aiCatalog.headers.get("access-control-allow-origin"), "*");
  assert.equal((await get("/.well-known/mcp/server-card.json")).status, 200);
  let throttled;
  for (let i = 0; i < 61; i++) {
    const response = await rpc({ jsonrpc: "2.0", id: 20 + i, method: "ping" });
    if (response.status === 429) { throttled = response; break; }
  }
  assert.ok(throttled); assert.equal(throttled.headers.get("retry-after"), "60");
  assert.equal((await get("/api/content/v1/search?q=test")).status, 429, "Public API and MCP share overload protection");
  assert.equal((await get("/")).status, 200, "Agent throttling does not block ordinary HTML pages");
  console.log("PASS public MCP HTTP: initialization, read-only tools, storage errors, origin validation, bounded bodies, stateless transport, discovery and throttling.");
  console.log("PASS agent runtime: HTTP Link/resources, content types, Accept negotiation, HTML preserved, private paths, marker spoofing and www redirect.");
});
await withServer(true, async (get, origin) => {
  for (const pathname of ["/", "/content.md", "/api/content/v1", "/.well-known/api-catalog", "/mcp", "/mcp/server-card", "/.well-known/ai-catalog.json"]) {
    assert.equal((await get(pathname, { accept: "text/markdown", "x-alelm-markdown-path": "/" })).status, 403, pathname);
  }
  const health = await get("/api/health");
  assert.equal(health.status, 503, "Readiness reaches the handler and reports the intentionally disconnected database");
  assert.deepEqual(await health.json(), { ok: false });
  const trusted = await get("/", { accept: "text/markdown", "x-alelm-origin-token": "agent-runtime-local-origin-secret-32", "cf-connecting-ip": "203.0.113.8" });
  assert.equal(trusted.status, 503, "Trusted Markdown reaches the public content reader with the origin guard enabled");
  assert.match(trusted.headers.get("content-type"), /text\/markdown/);
  const mcpResponse = await fetch(origin + "/mcp", { method: "POST", headers: {
    "x-alelm-origin-token": "agent-runtime-local-origin-secret-32", "cf-connecting-ip": "203.0.113.8",
    "content-type": "application/json", accept: "application/json, text/event-stream",
  }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "origin-test", version: "1" } } }) });
  assert.equal(mcpResponse.status, 200, "Trusted MCP goes through the same origin guard");
  console.log("PASS agent origin protection: Markdown and discovery cannot bypass the origin guard; health stays available.");
});
