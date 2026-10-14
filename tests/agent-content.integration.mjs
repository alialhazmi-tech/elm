import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const source = process.env.TEST_DATABASE_URL;
if (!source || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error("Isolated TEST_DATABASE_URL named alelm_test* required");
const name = `alelm_test_agents_${process.pid}`;
const url = new URL(source); url.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: source }); await admin.connect();
const directory = `tmp/agent-test-${process.pid}`;
await mkdir(directory, { recursive: true });
let client;
try {
  await admin.query(`create database "${name}"`);
  client = new pg.Client({ connectionString: url.href }); await client.connect();
  globalThis.__agentDb = drizzle(client);
  await migrate(globalThis.__agentDb, { migrationsFolder: "drizzle" });
  await build({ stdin: { contents: `
    export { GET as article } from './app/api/content/v1/articles/[id]/route';
    export { GET as search } from './app/api/content/v1/search/route';
    export { GET as markdown } from './app/content.md/route';
    export { POST as mcp } from './app/mcp/route';
  `, resolveDir: process.cwd() }, outfile: `${directory}/subject.mjs`,
    bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-database-and-cache", setup(b) {
      b.onResolve({ filter: /^(?:@\/lib\/db|@\/lib\/content\/cache|\.\/cache)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "@/lib/db"
        ? "export function getDb(){return globalThis.__agentDb}"
        : "export function cachedPublicQuery(key, ttl, load){return load()}; export function invalidatePublicContent(){}", loader: "js" }));
    } }],
  });
  const subject = await import(`../${directory}/subject.mjs`);
  const article = (id) => subject.article(new Request(`https://alelm.net/api/content/v1/articles/${id}`), { params: Promise.resolve({ id }) });
  const search = (query = "الفضاء", page = "1") => subject.search(new Request(`https://alelm.net/api/content/v1/search?q=${encodeURIComponent(query)}&page=${page}`));
  const md = (path) => subject.markdown(new Request("https://alelm.net/content.md", { headers: path ? { "x-alelm-markdown-path": new URL(path, "https://alelm.net").pathname } : {} }));
  const iso = (offset) => new Date(Date.now() + offset).toISOString();
  async function insert(id, status = "published", published = iso(-60_000), revision = null, format = "news", publicNumber = null) {
    await client.query(`insert into stories(id,slug,section,title,excerpt,status,published_at,revision_of,body,format,public_number)
      values($1,'خبر','sciences',$2,'ملخص الفضاء',$3,$4,$5,$6,$7,$8)`,
      [id, `الفضاء ${id}`, status, published, revision, `<h2>تفاصيل</h2><p>متن ${id} <a href="https://example.org/source">المصدر</a></p>`, format, publicNumber]);
  }
  for (const status of ["draft", "review", "scheduled", "archived"]) await insert(status, status);
  await insert("future", "published", iso(86400_000));
  await insert("revision", "published", iso(-1000), "original");
  await insert("undated", "published", null);
  await insert("jak", "published", iso(-1000), null, "jakalelm");
  await insert("1658"); await insert("1660");
  await insert("public", "published", iso(-2000), null, "news", 920001);
  await client.query("update stories set fact_check=$1 where id='public'", [JSON.stringify({ rumor: "قول متداول", truth: "تصحيح موثق", internal: "PRIVATE_FIELD" })]);
  for (const id of ["draft", "review", "scheduled", "archived", "future", "revision", "undated", "jak", "missing", "x".repeat(65)]) {
    assert.equal((await article(id)).status, 404, id);
    assert.equal((await md(`/sciences/${id}/خبر`)).status, 404, `Markdown ${id}`);
  }
  const response = await article("920001"); assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.publisher, "العلم"); assert.equal(payload.id, "920001");
  assert.deepEqual(payload.factCheck, { rumor: "قول متداول", truth: "تصحيح موثق" });
  assert.equal(payload.url, "https://alelm.net/sciences/920001/%D8%AE%D8%A8%D8%B1");
  assert.match(payload.bodyMarkdown, /\[المصدر\]\(https:\/\/example.org\/source\)/);
  assert.deepEqual(Object.keys(payload).sort(), ["id", "title", "description", "url", "section", "image", "publishedAt", "updatedAt", "publisher", "language", "bodyMarkdown", "videoUrl", "factCheck"].sort());
  assert.equal((await (await article("1658")).json()).id, "1660");
  const mcp = new Client({ name: "public-read-test", version: "1.0.0" });
  await mcp.connect(new StreamableHTTPClientTransport(new URL("https://alelm.net/mcp"), {
    fetch: async (url, init) => subject.mcp(new Request(url, init)),
  }));
  try {
    const tools = await mcp.listTools();
    assert.deepEqual(tools.tools.map(tool => tool.name).sort(), ["read_article", "search_articles"]);
    assert.ok(tools.tools.every(tool => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint));
    const found = await mcp.callTool({ name: "search_articles", arguments: { query: "الفضاء" } });
    assert.equal(found.structuredContent.total, 2);
    const read = await mcp.callTool({ name: "read_article", arguments: { id: "920001" } });
    assert.deepEqual(read.structuredContent, payload);
    for (const id of ["draft", "review", "scheduled", "archived", "future", "revision", "undated", "jak"]) {
      const hidden = await mcp.callTool({ name: "read_article", arguments: { id } });
      assert.equal(hidden.isError, true, `MCP must hide ${id}`);
      assert.doesNotMatch(JSON.stringify(hidden), /PRIVATE_FIELD|postgres|select /i);
    }
    for (const args of [{ id: "../tahrir" }, { id: "https://example.org" }, { id: "920001", publish: true }]) {
      assert.equal((await mcp.callTool({ name: "read_article", arguments: args })).isError, true);
    }
    for (const name of ["publish_article", "delete_article", "edit_article", "upload_file", "get_account"]) {
      assert.equal((await mcp.callTool({ name, arguments: {} })).isError, true);
    }
  } finally { await mcp.close(); }
  for (const path of ["/sciences/920001/خبر", "/sciences/920001/%d8%ae%d8%a8%d8%b1"]) {
    const result = await md(path); assert.equal(result.status, 200);
    assert.equal(result.headers.get("Content-Type"), "text/markdown; charset=utf-8");
    assert.equal(result.headers.get("Vary"), "Accept");
    assert.equal(result.headers.get("Cache-Control"), "private, no-store");
    assert.equal(result.headers.get("Content-Location"), payload.url);
    assert.match(await result.text(), /متن public/);
  }
  const alias = await md("/sciences/public/wrong-slug");
  assert.equal(alias.status, 308); assert.equal(alias.headers.get("Location"), payload.url);
  assert.equal((await md()).status, 404);
  assert.equal((await md("/tahrir/editor/public")).status, 404);
  const home = await md("/"); assert.equal(home.status, 200);
  assert.doesNotMatch(await home.text(), /draft|review|scheduled|archived|future|revision|undated|1658|jak/);
  const results = await (await search()).json();
  assert.equal(results.total, 2); assert.equal(results.capped, false);
  for (const [q, page] of [["", "1"], [" ", "1"], ["x".repeat(201), "1"], ["خبر", "0"], ["خبر", "11"], ["خبر", "1.5"]]) assert.equal((await search(q, page)).status, 400);
  for (let i = 0; i < 205; i++) await insert(`extra-${i}`);
  const capped = await (await search()).json();
  assert.equal(capped.items.length, 20); assert.equal(capped.total, 200); assert.equal(capped.pageCount, 10); assert.equal(capped.capped, true);
  assert.equal((await (await search("الفضاء", "10")).json()).items.length, 20);
  await client.query("update stories set status='archived' where id='public'");
  assert.equal((await article("920001")).status, 404);
  assert.equal((await md("/sciences/920001/خبر")).status, 404);
  await client.query("delete from stories");
  assert.equal((await (await search()).json()).total, 0);
  assert.equal((await md("/")).status, 200);
  await client.query("drop table stories cascade");
  const unavailableMcp = await subject.mcp(new Request("https://alelm.net/mcp", {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-11-25" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "read_article", arguments: { id: "920001" } } }),
  }));
  const unavailablePayload = await unavailableMcp.json();
  assert.equal(unavailablePayload.result.isError, true);
  assert.doesNotMatch(JSON.stringify(unavailablePayload), /postgres|select |DATABASE_URL|test_only/i);
  for (const noDb of [false, true]) {
    if (noDb) globalThis.__agentDb = null;
    for (const result of [await article("920001"), await search(), await md("/"), await md("/sciences/920001/خبر")]) {
      assert.equal(result.status, 503);
      assert.match(result.headers.get("Cache-Control"), /no-store/);
      assert.equal(result.headers.get("Retry-After"), "60");
      assert.doesNotMatch(await result.text(), /postgres|select |DATABASE_URL|demo|test_only/i);
    }
  }
  console.log("PASS agent content: isolated migrated database, publication filters, projections, bounded search, canonical IDs, Markdown, withdrawal, empty corpus and storage failures.");
} finally {
  await client?.end();
  await admin.query(`drop database if exists "${name}" with (force)`);
  await admin.end(); delete globalThis.__agentDb;
  await rm(directory, { recursive: true, force: true });
}
