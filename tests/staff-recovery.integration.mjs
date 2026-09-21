import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createRecoveryToken, RECOVERY_TTL_MS } from "../lib/tahrir/password-recovery-token.ts";
import { hashPassword, verifyPassword } from "../lib/tahrir/crypto.ts";

const source = process.env.TEST_DATABASE_URL;
if (!source || !["localhost", "127.0.0.1"].includes(new URL(source).hostname) || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error("Isolated local TEST_DATABASE_URL required");
const name = `alelm_test_staff_recovery_${process.pid}`;
const url = new URL(source); url.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: source }); await admin.connect();
const directory = `tmp/staff-recovery-test-${process.pid}`;
await mkdir(directory, { recursive: true });
const previous = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = "isolated-staff-recovery-integration-secret-32";
let pool;
try {
  await admin.query(`create database "${name}"`);
  pool = new pg.Pool({ connectionString: url.href, max: 3 });
  globalThis.__staffRecoveryDb = drizzle(pool);
  await migrate(globalThis.__staffRecoveryDb, { migrationsFolder: "drizzle" });
  await build({ entryPoints: ["lib/tahrir/password-recovery.ts"], outfile: `${directory}/subject.mjs`, bundle: true, platform: "node", format: "esm", packages: "external", plugins: [{ name: "local-db", setup(b) {
    b.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: "db", namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const getDb=()=>globalThis.__staffRecoveryDb", loader: "js" }));
  } }] });
  const { redeemStaffRecovery } = await import(`../${directory}/subject.mjs`);
  const account = { id: "recovery-admin", username: "recovery@example.invalid", email: "recovery@example.invalid", passwordHash: await hashPassword("old-password-fixture"), sessionVersion: 1 };
  await pool.query("insert into users(id,username,email,display_name,password_hash,session_version,mfa_secret,mfa_recovery_hashes,role,created_at) values($1,$2,$3,'مدير تجريبي',$4,1,'mfa-preserved','[\"recovery-code\"]','admin',$5)", [account.id, account.username, account.email, account.passwordHash, new Date().toISOString()]);
  const token = createRecoveryToken(account, process.env.AUTH_SECRET);
  assert.equal(await redeemStaffRecovery(token, "short"), false);
  assert.equal(await redeemStaffRecovery(createRecoveryToken(account, process.env.AUTH_SECRET, Date.now() - RECOVERY_TTL_MS), "new-password-fixture"), false);
  assert.equal(await redeemStaffRecovery(`X${token.slice(1)}`, "new-password-fixture"), false);
  await pool.query("update users set status='suspended' where id=$1", [account.id]);
  assert.equal(await redeemStaffRecovery(token, "new-password-fixture"), false);
  await pool.query("update users set status='active',email='changed@example.invalid' where id=$1", [account.id]);
  assert.equal(await redeemStaffRecovery(token, "new-password-fixture"), false);
  await pool.query("update users set email=$2 where id=$1", [account.id, account.email]);
  // Simultaneous attempts use distinct connections; exactly one can consume the link.
  assert.deepEqual((await Promise.all([redeemStaffRecovery(token, "new-password-fixture"), redeemStaffRecovery(token, "new-password-fixture")])).sort(), [false, true]);
  assert.equal(await redeemStaffRecovery(token, "another-password-fixture"), false);
  const { rows: [saved] } = await pool.query("select * from users where id=$1", [account.id]);
  assert.equal(await verifyPassword("new-password-fixture", saved.password_hash), true);
  assert.equal(await verifyPassword("old-password-fixture", saved.password_hash), false);
  assert.equal(saved.session_version, 2);
  assert.equal(saved.must_change_password, 0);
  assert.equal(saved.mfa_secret, "mfa-preserved");
  assert.deepEqual(saved.mfa_recovery_hashes, ["recovery-code"]);
  assert.equal(saved.role, "admin");
  const { rows: audit } = await pool.query("select actor,action,detail from audit_log where action='users:recover-password'");
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor, account.username);
  assert.ok(!JSON.stringify(audit).includes(token));
  console.log("staff recovery: expiry, tampering, suspension, changed identity, concurrent redemption, session invalidation, MFA preservation and audit passed");
} finally {
  if (previous === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = previous;
  delete globalThis.__staffRecoveryDb;
  await pool?.end();
  // Pool shutdown can resolve before sockets close; let PostgreSQL wait instead of terminating them.
  await admin.query(`drop database if exists "${name}"`);
  await admin.end();
  await rm(directory, { recursive: true, force: true });
}
