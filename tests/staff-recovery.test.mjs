import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { build } from "esbuild";
import { createRecoveryToken, readRecoveryToken, recoveryAccountState, RECOVERY_TTL_MS } from "../lib/tahrir/password-recovery-token.ts";
import { createSessionToken, readSessionToken } from "../lib/tahrir/crypto.ts";

const secret = "isolated-recovery-secret-longer-than-32-characters";
const account = { id: "staff-fixture", username: "staff@example.invalid", email: "staff@example.invalid", passwordHash: "fixture", sessionVersion: 4 };
const form = (values) => { const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.set(key, value)); return data; };

test("رمز استعادة الإدارة موقّع ومؤقت ومنفصل عن جلسة الدخول", async () => {
  const before = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  try {
    const now = Date.now();
    const token = createRecoveryToken(account, secret, now);
    const claims = readRecoveryToken(token, secret, now);
    assert.equal(claims.userId, account.id);
    assert.equal(claims.version, 4);
    assert.equal(readRecoveryToken(token, secret, now + RECOVERY_TTL_MS), null);
    assert.equal(readRecoveryToken(token, "another-long-secret-for-isolated-testing"), null);
    assert.equal(readRecoveryToken(`X${token.slice(1)}`, secret, now), null);
    assert.equal(readRecoveryToken(`${token}.extra`, secret, now), null);
    assert.equal(readRecoveryToken("!invalid!", secret, now), null);
    assert.equal(await readSessionToken(token), null);
    assert.equal(readRecoveryToken(await createSessionToken({ userId: account.id, username: account.username, role: "admin", displayName: "اختبار" }), secret), null);
    for (const field of ["email", "username", "passwordHash"]) {
      assert.notEqual(recoveryAccountState({ ...account, [field]: "changed" }), claims.state);
    }
  } finally { if (before === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = before; }
});

test("طلب استعادة الإدارة عام ولا يكشف الحساب ولا يرسل للمعلّق، والتأكيد شرط قبل الاستهلاك", async () => {
  await mkdir("tmp", { recursive: true });
  const directory = await mkdtemp(`${process.cwd()}/tmp/staff-recovery-actions-`);
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  const state = globalThis.__staffRecoveryFixture = { tasks: [], sent: [], limits: [], allowed: true, configured: true, user: { ...account, displayName: "تجربة", status: "active" }, redeemed: 0 };
  try {
    const mocks = {
      "next/headers": "export async function headers(){return new Headers({'x-forwarded-for':'127.0.0.1'})}",
      "next/server": "export function after(fn){globalThis.__staffRecoveryFixture.tasks.push(fn)}",
      "@/lib/membership/email/delivery": "export const accountEmailConfigured=()=>globalThis.__staffRecoveryFixture.configured;export async function deliverAccountEmail(...args){globalThis.__staffRecoveryFixture.sent.push(args)}",
      "@/lib/tahrir/service": "export async function findUser(){return globalThis.__staffRecoveryFixture.user}",
      "@/lib/tahrir/rate-limit": "export async function consumeLimit(...args){globalThis.__staffRecoveryFixture.limits.push(args);return globalThis.__staffRecoveryFixture.allowed}",
      "@/lib/tahrir/password-recovery": "export async function redeemStaffRecovery(){globalThis.__staffRecoveryFixture.redeemed++;return true}",
    };
    await build({ entryPoints: ["app/tahrir/recover/actions.ts"], outfile: `${directory}/actions.mjs`, bundle: true, platform: "node", format: "esm", packages: "external", plugins: [{ name: "recovery-fixtures", setup(b) {
      b.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: "fixture" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: mocks[args.path], loader: "js" }));
    } }] });
    const { requestStaffPasswordReset: request, completeStaffPasswordReset: complete } = await import(`${directory}/actions.mjs`);
    const input = form({ username: " STAFF@example.invalid " });
    const active = await request({}, input);
    assert.equal(state.sent.length, 0); // even the account lookup/delivery waits until after the response
    await state.tasks.shift()();
    assert.equal(state.sent.length, 1);
    assert.equal(state.sent[0][0], account.email);
    assert.match(state.sent[0][1].text, /تحرير|الإدارة/);
    const link = state.sent[0][1].text.match(/https:\/\/alelm.net\/tahrir\/recover\?token=([^\s]+)/)[1];
    assert.equal(readRecoveryToken(decodeURIComponent(link), secret).userId, account.id);
    assert.equal(state.limits[1][1], "staff@example.invalid");
    state.user = null;
    assert.deepEqual(await request({}, input), active);
    await state.tasks.shift()();
    state.user = { ...account, status: "suspended" };
    assert.deepEqual(await request({}, input), active);
    await state.tasks.shift()();
    assert.equal(state.sent.length, 1);
    state.allowed = false;
    assert.match((await request({}, input)).error, /طلبات كثيرة/);
    assert.equal(state.tasks.length, 0);
    state.allowed = true;
    assert.match((await complete({}, form({ token: "fixture", password: "valid-password-unique", confirmPassword: "different" }))).error, /غير متطابقتين/);
    assert.equal(state.redeemed, 0);
    assert.ok((await complete({}, form({ token: "fixture", password: "valid-password-unique", confirmPassword: "valid-password-unique" }))).success);
    assert.equal(state.redeemed, 1);
    state.configured = false;
    assert.match((await request({}, input)).error, /غير متاحة/);
  } finally { if (previous === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = previous; delete globalThis.__staffRecoveryFixture; await rm(directory, { recursive: true, force: true }); }
});
