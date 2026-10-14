import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PublicReadLimiter } from "../lib/agents/read-guard.ts";
import { PUBLIC_TOOLS, toolRequest } from "../lib/agents/tools-contract.ts";
import { publicToolPage, registerPublicBrowserTools } from "../lib/agents/webmcp.ts";
import { readMcpRequest } from "../lib/agents/mcp-request.ts";

test("MCP bounds streamed bodies, rejects batches, and times out slow uploads", async () => {
  const request = body => new Request("https://alelm.net/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body, duplex: "half" });
  assert.deepEqual(await readMcpRequest(request('{"jsonrpc":"2.0"}')), { jsonrpc: "2.0" });
  await assert.rejects(readMcpRequest(request("[{},{}]")), error => error.status === 400);
  await assert.rejects(readMcpRequest(request("{invalid")), error => error.code === -32700);
  const large = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(16_385)); } });
  await assert.rejects(readMcpRequest(request(large)), error => error.status === 413);
  let cancelled = false;
  const slow = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(readMcpRequest(request(slow), 10), error => error.status === 408);
  assert.equal(cancelled, true);
});

test("public browser tools accept only bounded read arguments and never arbitrary URLs", () => {
  assert.equal(toolRequest("search_articles", { query: " السعودية " }), "/api/content/v1/search?q=%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9&page=1");
  assert.equal(toolRequest("read_article", { id: "300369" }), "/api/content/v1/articles/300369");
  for (const input of [null, [], { query: " " }, { query: "x".repeat(201) }, { query: "خبر", page: 11 }, { query: "خبر", page: "1" }, { query: "خبر", page: 1.5 }, { query: "خبر", publish: true }]) {
    assert.throws(() => toolRequest("search_articles", input));
  }
  for (const input of [{ id: "https://alelm.net/tahrir" }, { id: "../api/me" }, { id: "x".repeat(65) }, { id: "300369", status: "published" }]) assert.throws(() => toolRequest("read_article", input));
  assert.deepEqual(Object.keys(PUBLIC_TOOLS), ["search_articles", "read_article"]);
});

test("tools are absent on private and unsupported pages", () => {
  for (const path of ["/", "/search", "/health/123/خبر"]) assert.equal(publicToolPage(path), true);
  for (const path of ["/account", "/join", "/tahrir", "/tahrir/editor/123", "/api/me", "/jak/123/خبر"]) assert.equal(publicToolPage(path), false);
});

test("WebMCP executes GET without credentials, validates before fetch, and cleans up", async () => {
  const tools = new Map(); const removed = []; const calls = [];
  const context = { registerTool: async (tool, options) => { tools.set(tool.name, { tool, options }); }, unregisterTool: name => removed.push(name) };
  const cleanup = registerPublicBrowserTools(context, async (path, options) => {
    calls.push({ path, options }); return Response.json({ id: "123", publisher: "العلم" });
  });
  const read = tools.get("read_article").tool;
  assert.equal(read.annotations.readOnlyHint, true); assert.equal(read.annotations.untrustedContentHint, true);
  const result = await read.execute({ id: "123" }); assert.equal(result.publisher, "العلم");
  assert.equal(calls[0].options.method, "GET"); assert.equal(calls[0].options.credentials, "omit");
  assert.equal(calls[0].options.redirect, "error"); assert.equal(calls[0].options.signal.aborted, false);
  await assert.rejects(read.execute({ id: "/api/tahrir/stories" })); assert.equal(calls.length, 1);
  cleanup(); assert.equal(calls[0].options.signal.aborted, true);
  assert.equal(tools.get("read_article").options.signal.aborted, true);
  assert.deepEqual(removed, ["search_articles", "read_article"]);
  await assert.rejects(read.execute({ id: "123" }), /no longer available/);
});

test("WebMCP gracefully handles unsupported registration and fails on unavailable content", async () => {
  assert.doesNotThrow(() => registerPublicBrowserTools({ registerTool() { throw new Error("unsupported"); } })());
  let read;
  const cleanup = registerPublicBrowserTools({ registerTool(tool) { if (tool.name === "read_article") read = tool; } }, async () => new Response("private backend diagnostic", { status: 503 }));
  await assert.rejects(read.execute({ id: "123" }), error => error.message === "Public content request failed (503)");
  cleanup();
});

test("public limits bound concurrent work, per-client and total traffic, and reset", () => {
  const limiter = new PublicReadLimiter(); const now = 100_000;
  const slots = Array.from({ length: 8 }, (_, i) => limiter.take(String(i), now));
  assert.ok(slots.every(Boolean)); assert.equal(limiter.take("ninth", now), null);
  for (const slot of slots) { slot.release(); slot.release(); }
  for (let i = 0; i < 59; i++) { const slot = limiter.take("0", now); assert.ok(slot); slot.release(); }
  assert.equal(limiter.take("0", now), null);
  assert.ok(limiter.take("0", now + 60_001));
  const total = new PublicReadLimiter();
  for (let i = 0; i < 600; i++) { const slot = total.take(String(i % 20), now); assert.ok(slot); slot.release(); }
  assert.equal(total.take("new", now), null);
});

test("catalog and current/legacy cards describe real read-only endpoints consistently", async () => {
  const read = path => readFile(new URL(`../public${path}`, import.meta.url), "utf8");
  const catalog = JSON.parse(await read("/.well-known/ai-catalog.json"));
  assert.equal(catalog.specVersion, "1.0"); assert.equal(catalog.host.identifier, "https://alelm.net");
  for (const entry of catalog.entries) {
    assert.match(entry.identifier, /^urn:air:alelm\.net:/);
    assert.ok(entry.url && !entry.data); assert.ok(entry.representativeQueries.length >= 2);
    await read(new URL(entry.url).pathname);
  }
  const card = JSON.parse(await read("/mcp/server-card"));
  const legacy = JSON.parse(await read("/.well-known/mcp/server-card.json"));
  assert.equal(card.$schema, "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json");
  assert.equal(card.name, legacy.serverInfo.name); assert.equal(card.version, legacy.serverInfo.version);
  assert.equal(card.remotes[0].type, "streamable-http"); assert.equal(card.remotes[0].url, legacy.endpoint);
  assert.equal(card.description.length <= 100, true);
  assert.deepEqual(Object.keys(legacy.capabilities), ["tools"]);
  assert.ok(!card.capabilities && !card.tools, "Current SEP excludes primitives from static cards");
});
