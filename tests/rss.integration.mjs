import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const source = process.env.TEST_DATABASE_URL;
if (!source || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error("Isolated TEST_DATABASE_URL named alelm_test* required");
const name = `alelm_test_rss_${process.pid}`;
const url = new URL(source); url.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: source }); await admin.connect();
const directory = `tmp/rss-test-${process.pid}`;
await mkdir(directory, { recursive: true });
let client;
try {
  await admin.query(`create database "${name}"`);
  client = new pg.Client({ connectionString: url.href }); await client.connect();
  globalThis.__rssDb = drizzle(client);
  await migrate(globalThis.__rssDb, { migrationsFolder: "drizzle" });
  await build({
    entryPoints: ["app/rss.xml/route.ts"], outfile: `${directory}/subject.mjs`,
    bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-database-and-cache", setup(b) {
      b.onResolve({ filter: /^(?:@\/lib\/db|\.\/cache)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "@/lib/db"
        ? "export function getDb(){return globalThis.__rssDb}"
        : "export function cachedPublicQuery(key, ttl, load){return load()}", loader: "js" }));
    } }],
  });
  const { GET } = await import(`../${directory}/subject.mjs`);
  const now = Date.now();
  async function insert(id, status, publishedAt, revisionOf = null) {
    await client.query(`insert into stories(id,slug,section,title,excerpt,status,published_at,revision_of,body)
      values($1,$1,'sciences',$1,'ملخص منشور',$2,$3,$4,'PRIVATE BODY')`, [id, status, publishedAt, revisionOf]);
  }
  const iso = (offset) => new Date(now + offset).toISOString();
  for (const status of ["draft", "review", "scheduled", "archived"]) await insert(status, status, iso(-1000));
  await insert("revision", "published", iso(-1000), "original");
  await insert("future", "published", iso(86400_000));
  await insert("undated", "published", null);
  await insert("1658", "published", iso(-1000));
  for (let index = 0; index < 60; index++) await insert(`article-${index}`, "published", iso(-(index + 1) * 60000));
  await client.query("update stories set boosted_at=$1 where id='article-59'", [iso(-1000)]);
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/rss+xml; charset=utf-8");
  assert.equal(response.headers.get("Cache-Control"), "public, no-cache, must-revalidate");
  const xml = await response.text();
  assert.equal((xml.match(/<item>/g) || []).length, 50);
  assert.ok(xml.indexOf("<title>article-0</title>") < xml.indexOf("<title>article-1</title>"));
  assert.doesNotMatch(xml, /draft|review|scheduled|archived|revision|future|undated|1658|article-59|PRIVATE BODY/);
  await client.query("update stories set status='archived' where id='article-0'");
  assert.doesNotMatch(await (await GET()).text(), /<title>article-0<\/title>/);
  await client.query("delete from stories");
  assert.doesNotMatch(await (await GET()).text(), /<item>/);
  await client.query("drop table stories cascade");
  for (const missingDb of [false, true]) {
    if (missingDb) globalThis.__rssDb = null;
    const failure = await GET();
    assert.equal(failure.status, 503);
    assert.equal(failure.headers.get("Cache-Control"), "no-store");
    assert.equal(failure.headers.get("Retry-After"), "60");
    assert.equal(await failure.text(), "Feed temporarily unavailable");
  }
  console.log("PASS RSS: published-only database query, 50-item limit, publication order, withdrawal, empty feed and storage failure");
} finally {
  await client?.end();
  await admin.query(`drop database if exists "${name}" with (force)`);
  await admin.end();
  delete globalThis.__rssDb;
  await rm(directory, { recursive: true, force: true });
}
