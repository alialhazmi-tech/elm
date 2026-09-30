import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const source = process.env.TEST_DATABASE_URL || "postgresql://alialhazmi@localhost:5432/alelm_test";
if (!/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error("Isolated TEST_DATABASE_URL named al elm_test* required");
const database = `alelm_test_jak_reports_${process.pid}`;
const url = new URL(source); url.pathname = `/${database}`;
const admin = new pg.Client({ connectionString: source });
const directory = `tmp/jak-reports-test-${process.pid}`;
let client;

const permissions = (...keys) => new Set(["jak.manage", ...keys]);
const actor = (userId, ...keys) => ({ userId, username: userId, displayName: userId, mustChangePassword: false, can: key => permissions(...keys).has(key) });
const owner = actor("owner", "story.create", "story.edit.own", "story.submit", "story.archive");
const other = actor("other", "story.create", "story.edit.own", "story.submit");
const publisher = actor("publisher", "story.publish", "story.archive", "story.restore");
const id = "11111111-1111-4111-8111-111111111111";
const input = (overrides = {}) => ({ id, expectedVersion: 0, title: "تقرير اختبار", excerpt: "موجز", image: null, html: "<main>خام</main>", css: ".x{color:red}", showOnHomepage: true, ...overrides });

await admin.connect();
try {
  await admin.query(`create database "${database}"`);
  client = new pg.Client({ connectionString: url.href });
  await client.connect();
  const databaseClient = drizzle(client);
  await migrate(databaseClient, { migrationsFolder: "drizzle" });
  globalThis.__jakReportsDb = databaseClient;
  await mkdir(directory, { recursive: true });
  await build({
    stdin: { contents: "export * from './lib/tahrir/jak-reports.ts';", resolveDir: process.cwd(), loader: "ts" },
    outfile: `${directory}/subject.mjs`, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "jak-db", setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: "db-fixture", namespace: "jak-fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "jak-fixture" }, () => ({ loader: "js", contents: "export const getDb=()=>globalThis.__jakReportsDb" }));
    } }],
  });
  const subject = await import(`../${directory}/subject.mjs`);

  const created = await subject.saveJakReport(input(), owner);
  assert.equal(created.status, "draft");
  assert.equal(created.version, 1);
  assert.equal(created.html, input().html);
  const retried = await subject.saveJakReport(input(), owner);
  assert.equal(retried.version, 1, "same stable create request is idempotent");
  await assert.rejects(subject.saveJakReport(input({ title: "محتوى مختلف" }), owner), error => error.status === 409);

  const [createdAudit] = (await client.query("select count(*)::int as n from audit_log where story_id=$1 and action='jak:report-create'", [id])).rows;
  assert.equal(createdAudit.n, 1);
  assert.equal((await subject.listJakReports({ actor: owner })).length, 1);
  assert.equal((await subject.listJakReports({ actor: other })).length, 0, "own editor cannot list another author's raw draft");
  await assert.rejects(subject.getJakReport(id, other), error => error.status === 403);
  assert.equal((await subject.getJakReport(id, owner)).id, id);

  const saved = await subject.saveJakReport(input({ expectedVersion: 1, title: "تعديل أول" }), owner);
  const contenders = await Promise.allSettled([
    subject.saveJakReport(input({ expectedVersion: saved.version, title: "متنافس 1" }), owner),
    subject.saveJakReport(input({ expectedVersion: saved.version, title: "متنافس 2" }), owner),
  ]);
  assert.equal(contenders.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(contenders.filter(result => result.status === "rejected" && result.reason.status === 409).length, 1);
  const [saveAudits] = (await client.query("select count(*)::int as n from audit_log where story_id=$1 and action='jak:report-save'", [id])).rows;
  assert.equal(saveAudits.n, 2, "only successful CAS saves are audited");

  const latest = await subject.getJakReport(id);
  const review = await subject.transitionJakReport(id, "review", latest.version, owner);
  await assert.rejects(subject.transitionJakReport(id, "draft", review.version, other), error => error.status === 403, "submit permission alone cannot return another author's review");
  const published = await subject.transitionJakReport(id, "published", review.version, publisher);
  const archived = await subject.transitionJakReport(id, "archived", published.version, publisher);
  await assert.rejects(subject.transitionJakReport(id, "published", archived.version, publisher), error => error.status === 409, "archived report must be restored before publishing");
  const restored = await subject.transitionJakReport(id, "draft", archived.version, publisher);
  assert.equal(restored.status, "draft");

  const [statusAudits] = (await client.query("select count(*)::int as n from audit_log where story_id=$1 and action like 'jak:report-%'", [id])).rows;
  assert.equal(statusAudits.n, 7, "create, saves and successful transitions are audited; rejected transitions are not");
  console.log("Jak reports integration passed: ownership filtering, stable create retry, CAS loser, status permissions, restore gate and audit atomicity.");
} finally {
  await client?.end();
  await admin.query(`drop database if exists "${database}"`);
  await admin.end();
  await rm(directory, { recursive: true, force: true });
  delete globalThis.__jakReportsDb;
}
