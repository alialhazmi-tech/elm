import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pg from "pg";
import { DATABASE_READINESS_SQL } from "../lib/db-readiness.ts";
import { hashPassword, verifyPassword } from "../lib/tahrir/crypto.ts";

const source = process.env.TEST_DATABASE_URL;
if (!source || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error("Isolated TEST_DATABASE_URL named alelm_test* required");
const database = `alelm_test_adoption_${process.pid}`;
const url = new URL(source); url.pathname = `/${database}`;
const admin = new pg.Client({ connectionString: source });
await admin.connect();
let client;
try {
  await admin.query(`create database "${database}"`);
  client = new pg.Client({ connectionString: url.href });
  await client.connect();
  await client.query(await readFile("drizzle/0000_baseline.sql", "utf8"));
  const passwordHash = await hashPassword("isolated-test-password");
  await client.query("insert into users(id,username,display_name,password_hash,created_at) values('existing-user','existing-user','Existing editor',$1,'2026-09-01T00:00:00Z')", [passwordHash]);
  await client.query("insert into stories(id,slug,section,title,body,status) values('existing-story','original-slug','health','Existing title','Original body','published')");
  await client.query("insert into member_likes(member_id,story_id,created_at) values('existing-member','existing-story','2026-09-01T00:00:00Z')");
  const before = (await client.query(DATABASE_READINESS_SQL)).rows.map(row => row.missing);
  assert.ok(before.includes("users.session_version"));
  assert.ok(before.includes("users.mfa_secret"));
  assert.ok(before.includes("request_limits.key"));
  assert.ok(before.includes("public.users_username_normalized_uidx"));
  // Conflicting legacy names must stop migration without modifying either account.
  await client.query("insert into users(id,username,display_name,password_hash,created_at) values('case-conflict',' Existing-User ','Duplicate fixture',$1,now())", [passwordHash]);
  await assert.rejects(promisify(execFile)(process.execPath, ['scripts/migrate-db.mjs', '--apply'], {
    env: { ...process.env, TEST_DATABASE_URL: url.href, DATABASE_URL_UNPOOLED: url.href },
  }), error => error.stderr.includes('users_username_normalized_uidx'));
  assert.equal((await client.query('select count(*)::int n from users')).rows[0].n, 2);
  await client.query("delete from users where id='case-conflict'");
  for (let run = 0; run < 2; run++) {
    await promisify(execFile)(process.execPath, ["scripts/migrate-db.mjs", "--apply"], {
      env: { ...process.env, TEST_DATABASE_URL: url.href, DATABASE_URL_UNPOOLED: url.href },
    });
  }
  assert.deepEqual((await client.query(DATABASE_READINESS_SQL)).rows, []);
  await client.query('begin');
  await client.query('drop index users_username_normalized_uidx');
  assert.deepEqual((await client.query(DATABASE_READINESS_SQL)).rows.map(row => row.missing), ['public.users_username_normalized_uidx']);
  await client.query('rollback');
  const user = (await client.query("select * from users where id='existing-user'")).rows[0];
  assert.equal(user.username, 'existing-user');
  assert.equal(user.session_version, 1);
  assert.equal(user.mfa_secret, null);
  assert.equal(user.password_hash, passwordHash);
  assert.equal(await verifyPassword("isolated-test-password", user.password_hash), true);
  assert.deepEqual((await client.query("select id,slug,body,status from stories")).rows, [{ id: "existing-story", slug: "original-slug", body: "Original body", status: "published" }]);
  assert.equal((await client.query("select count(*)::int as n from member_saved_stories")).rows[0].n, 1);
  await client.query("drop function alelm_reserve_ai(text,integer,integer,integer)");
  assert.deepEqual((await client.query(DATABASE_READINESS_SQL)).rows.map(row => row.missing), ["public.alelm_reserve_ai(text,integer,integer,integer)"]);
  console.log("Legacy schema adoption: readiness fails before migration, passes after; credentials/content preserved; replay is idempotent; missing function detected.");
} finally {
  await client?.end();
  await admin.query(`drop database if exists "${database}"`);
  await admin.end();
}
