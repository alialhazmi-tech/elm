import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !/^alelm_test/.test(new URL(connectionString).pathname.slice(1))) throw new Error("Isolated TEST_DATABASE_URL database named alelm_test* required.");
const admin = new pg.Client({ connectionString });
await admin.connect();
const directory = `tmp/workflow-test-${process.pid}`;
await mkdir(directory, { recursive: true });
const context = new AsyncLocalStorage();
globalThis.__alelmDb = context;
let checks = 0;
async function withDb(fn) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const db = drizzle(client);
  db.batch = async (queries) => {
    await client.query("begin");
    try {
      const result = [];
      for (const query of queries) result.push(await query);
      await client.query("commit");
      return result;
    } catch (e) { await client.query("rollback"); throw e; }
  };
  try { return await context.run(db, fn); } finally { await client.end(); }
}
const editor = { userId: "editor-1", username: "editor", displayName: "كاتب", mustChangePassword: false, can: key => ["story.create", "story.edit.own", "story.submit"].includes(key) };
try {
  await migrate(drizzle(admin), { migrationsFolder: "drizzle" });
  await migrate(drizzle(admin), { migrationsFolder: "drizzle" }); // idempotent replay
  await admin.query("truncate stories, story_slides, jak_sources, story_versions, audit_log, request_limits, ai_usage, ai_settings, users, member_saved_stories, member_likes, newsletter_subscribers, member_profiles, interests, member_interests, member_topic_scores, member_story_stats, member_events cascade");
  await build({
    stdin: { contents: `export * from './lib/tahrir/service'; export { replaceSlides } from './lib/tahrir/jak'; export * from './lib/tahrir/workflow'; export * from './lib/tahrir/write-policy'; export { consumeLimit } from './lib/tahrir/rate-limit'; export * from './lib/ai/usage'; export * from './lib/personalization/saved'; export { verifyMfa } from './lib/tahrir/mfa'; export { POST as subscribe } from './app/api/newsletter/route'; export { POST as saveApi } from './app/api/me/saved/route'; export { changeOwnPassword, resetMemberPassword, validatePassword } from './lib/tahrir/admin'; export { loadActor } from './lib/tahrir/access'; export { saveMemberInterests, seedInterestCatalog, getMemberProfile } from './lib/membership/profile'; export { POST as profileApi } from './app/api/me/profile/route'; export { pageByKeyword } from './lib/content/provider';`, resolveDir: process.cwd(), loader: "ts" },
    outfile: `${directory}/subject.mjs`, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-db", setup(builder) {
      builder.onResolve({ filter: /^next\/server$/ }, () => ({ path: "next/server.js", external: true }));
      builder.onResolve({ filter: /^(?:@\/lib\/db|\.\.\/db\.ts)$/ }, () => ({ path: "db", namespace: "test" }));
      builder.onResolve({ filter: /^@\/lib\/personalization\/session$/ }, () => ({ path: "session", namespace: "test" }));
      builder.onResolve({ filter: /^@\/lib\/content\/provider$/ }, () => ({ path: "provider", namespace: "test" }));
      builder.onResolve({ filter: /^\.\/auth$/ }, args => args.importer.endsWith('/access.ts') ? ({ path: "auth", namespace: "test" }) : undefined);
      builder.onLoad({ filter: /.*/, namespace: "test" }, args => ({ contents: ({
        db: "export function getDb(){return globalThis.__alelmDb.getStore()}",
        session: "export async function getSessionMemberId(){return globalThis.__alelmMemberId ?? null} export function privateJson(value,status=200){return Response.json(value,{status})}",
        provider: "export const seedContentProvider={getStory:async id=>id==='original'?{id}:null}",
        auth: "export async function getSession(){return globalThis.__alelmSession ?? null}",
      })[args.path], loader: "js" }));
    } }],
  });
  const subject = await import(`../${directory}/subject.mjs`);
  const input = { id: "original", title: "عنوان عربي", excerpt: "موجز", body: "المتن", section: "health", slug: "عنوان-عربي", seriesSlug: null, image: null };
  const saved = await withDb(() => subject.saveDraft(input, editor));
  assert.equal(saved.version, 1); checks++;
  const other = { ...editor, userId: "other" }; // Same display name is not ownership.
  await assert.rejects(withDb(() => subject.saveDraft({ ...input, expectedVersion: 1 }, other)), /صلاحية/); checks++;
  await assert.rejects(withDb(() => subject.saveDraft({ ...input, expectedVersion: 1 }, { ...editor, mustChangePassword: true })), /كلمة المرور/); checks++;
  const draft = await withDb(() => subject.getStory("original"));
  await withDb(() => subject.publishCheckedStory(draft, "publisher", "test"));
  const published = await withDb(() => subject.getStory("original"));
  const revision = await withDb(() => subject.saveDraft({ ...input, title: "نسخة جديدة", slug: "changed", section: "world", expectedVersion: published.version }, editor));
  assert.notEqual(revision.id, "original");
  assert.equal(revision.slug, input.slug); assert.equal(revision.section, input.section);
  assert.equal((await withDb(() => subject.getStory("original"))).title, input.title); checks++;
  await assert.rejects(withDb(() => subject.setStatus(published, "review", "editor")), /المسودة/); checks++;
  await assert.rejects(withDb(() => subject.replaceSlides("original", [], editor, "", published.version)), /مسودة مراجعة/); checks++;
  await assert.rejects(withDb(() => subject.saveDraft({ ...input, id: revision.id, expectedVersion: 0 }, editor)), /تغيّرت/); checks++;
  const revisionRow = await withDb(() => subject.getStory(revision.id));
  const outcomes = await Promise.allSettled([
    withDb(() => subject.publishCheckedStory(revisionRow, "publisher", "worker-1")),
    withDb(() => subject.publishCheckedStory(revisionRow, "publisher", "worker-2")),
  ]);
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
  assert.equal((await admin.query("select count(*)::int as n from audit_log where action='revision:published'")).rows[0].n, 1);
  assert.equal((await admin.query("select count(*)::int as n from story_versions")).rows[0].n, 1);
  assert.equal((await withDb(() => subject.getStory("original"))).title, "نسخة جديدة"); checks++;
  const newDraft = await withDb(() => subject.saveDraft({ ...input, id: "scheduled" }, editor));
  const schedRow = await withDb(() => subject.getStory(newDraft.id));
  await withDb(() => subject.scheduleStory(schedRow, "2030-01-01T00:00:00.000Z", "publisher"));
  const scheduled = await withDb(() => subject.getStory(newDraft.id));
  const changed = await withDb(() => subject.saveDraft({ ...input, id: scheduled.id, title: "تعديل موعد", expectedVersion: scheduled.version }, editor));
  assert.notEqual(changed.id, scheduled.id);
  assert.equal((await withDb(() => subject.getStory(scheduled.id))).status, "scheduled"); checks++;
  await withDb(() => subject.archiveStory(scheduled.id, "publisher", "سبب الأرشفة الكافي"));
  await assert.rejects(withDb(() => subject.publishCheckedStory(scheduled, "scheduler", "late"))); checks++;
  const limits = await Promise.all(Array.from({ length: 8 }, () => withDb(() => subject.consumeLimit("test", "same", 3, 60))));
  assert.equal(limits.filter(Boolean).length, 3); checks++;
  const version = (await admin.query("select id from story_versions limit 1")).rows[0];
  const current = await withDb(() => subject.getStory("original"));
  const restored = await withDb(() => subject.restoreStoryVersion(current, version.id, current.version, editor));
  assert.equal((await withDb(() => subject.getStory(restored.id))).title, input.title);
  assert.equal((await withDb(() => subject.getStory("original"))).title, "نسخة جديدة"); checks++;
  const reservations = await Promise.all(Array.from({ length: 8 }, () => withDb(() => subject.budgetGate({ dailyUsd: 1, monthlyUsd: 1 }, 30))));
  assert.equal(reservations.filter(r => r.ok).length, 3);
  const accepted = reservations.find(r => r.ok);
  await withDb(() => subject.logUsage({ reservationId: accepted.reservationId, tool: "test", model: "test", inputTokens: 1, outputTokens: 1, costCents: 5, actor: "test" }));
  assert.equal((await admin.query("select sum(cost_cents)::int as n from ai_usage")).rows[0].n, 65);
  await assert.rejects(withDb(() => subject.logUsage({ reservationId: accepted.reservationId, tool: "test", model: "test", inputTokens: 1, outputTokens: 1, costCents: 0, actor: "test" })), /ALREADY_SETTLED/); checks++;
  await withDb(() => subject.setSaved("alice", "original", true));
  await withDb(() => subject.setSaved("alice", "original", true));
  assert.equal(await withDb(() => subject.getSaved("alice", "original")), true);
  assert.equal(await withDb(() => subject.getSaved("bob", "original")), false);
  assert.equal((await admin.query("select count(*)::int as n from member_likes")).rows[0].n, 0);
  await withDb(() => subject.setSaved("bob", "original", false));
  assert.equal((await withDb(() => subject.savedPage("alice"))).length, 1); checks++;
  const request = () => new Request("https://test.invalid/api/newsletter", { method: "POST", body: JSON.stringify({ email: "TEST@example.test" }) });
  const subscriptions = await Promise.all([withDb(() => subject.subscribe(request())), withDb(() => subject.subscribe(request()))]);
  assert.ok(subscriptions.every(r => r.ok));
  assert.equal((await admin.query("select count(*)::int as n from newsletter_subscribers")).rows[0].n, 1);
  const unavailable = await context.run(null, () => subject.subscribe(request()));
  assert.equal(unavailable.status, 503); checks++;
  const { base32, sealMfa, totp, recoveryHash } = await import('../lib/tahrir/totp.ts');
  process.env.TAHRIR_MFA_KEY = 'ab'.repeat(32);
  const secret = base32(new TextEncoder().encode('12345678901234567890'));
  const cipher = await sealMfa(secret, 'secret:mfa-test');
  const recovery = 'AB'.repeat(16);
  await admin.query("insert into users(id,username,display_name,password_hash,created_at,mfa_secret,mfa_recovery_hashes) values($1,$2,$3,$4,$5,$6,$7)", ['mfa-test','mfa-test','test','test',new Date().toISOString(),cipher,JSON.stringify([await recoveryHash('mfa-test', recovery)])]);
  const mfaUser = await withDb(() => subject.findUser('mfa-test'));
  const code = await totp(secret, Math.floor(Date.now()/30000));
  const otpOutcomes = await Promise.all([withDb(() => subject.verifyMfa(mfaUser, code)), withDb(() => subject.verifyMfa(mfaUser, code))]);
  assert.equal(otpOutcomes.filter(Boolean).length, 1);
  const backupOutcomes = await Promise.all([withDb(() => subject.verifyMfa(mfaUser, recovery)), withDb(() => subject.verifyMfa(mfaUser, recovery))]);
  assert.equal(backupOutcomes.filter(Boolean).length, 1); checks++;
  const oldUser = await withDb(() => subject.findUser('mfa-test'));
  globalThis.__alelmSession = { userId: oldUser.id, sessionVersion: oldUser.sessionVersion };
  assert.ok(await withDb(() => subject.loadActor()));
  await withDb(() => subject.resetMemberPassword(oldUser.id, 'reset-password-123', 'admin'));
  await assert.rejects(withDb(() => subject.changeOwnPassword(oldUser.id, 'attacker-password-123', 'mfa-test', oldUser.sessionVersion)), /تغيّرت حماية/);
  assert.equal(await withDb(() => subject.loadActor()), null);
  const resetUser = await withDb(() => subject.findUser('mfa-test'));
  const changedUser = await withDb(() => subject.changeOwnPassword(resetUser.id, 'valid-password-123', 'mfa-test', resetUser.sessionVersion));
  assert.equal(changedUser.sessionVersion, resetUser.sessionVersion+1);
  assert.throws(() => subject.validatePassword('x'.repeat(513)), /512/); checks++;
  globalThis.__alelmMemberId = 'bob';
  const saveRequest = expectedMemberId => new Request('https://test.invalid/api/me/saved', { method:'POST', body:JSON.stringify({storyId:'original',saved:false,expectedMemberId}) });
  assert.equal((await withDb(() => subject.saveApi(saveRequest('alice')))).status,409);
  assert.equal((await withDb(() => subject.saveApi(saveRequest(undefined)))).status,409);
  assert.equal((await withDb(() => subject.saveApi(saveRequest('bob')))).status,200);
  assert.equal(await withDb(() => subject.getSaved('alice','original')),true);
  globalThis.__alelmMemberId = null;
  assert.equal((await withDb(() => subject.saveApi(saveRequest('alice')))).status,401); checks++;
  await admin.query("insert into ai_settings(id,data,updated_at) values('main',$1,$2) on conflict(id) do update set data=excluded.data", [JSON.stringify({governance:{editorialGuard:false,requireImageRights:false}}),new Date().toISOString()]);
  const stale = await withDb(() => subject.getStory(restored.id));
  await withDb(() => subject.scheduleStory(stale,'2000-01-01T00:00:00.000Z','publisher'));
  await admin.query("update stories set version=version+1 where id='original'");
  await withDb(() => subject.promoteDueScheduled());
  const returned = await withDb(() => subject.getStory(stale.id));
  assert.equal(returned.status,'review'); assert.equal(returned.scheduledAt,null);
  await withDb(() => subject.promoteDueScheduled());
  assert.equal((await admin.query("select count(*)::int as n from audit_log where action='schedule:conflict'")).rows[0].n,1); checks++;
  await withDb(() => subject.seedInterestCatalog());
  await Promise.all([withDb(() => subject.saveMemberInterests('alice',['health','science'])),withDb(() => subject.saveMemberInterests('alice',['economy','technology']))]);
  const profile = await withDb(() => subject.getMemberProfile('alice'));
  assert.equal(profile.interests.length,2);
  assert.ok([['health','science'],['economy','technology']].some(ids => ids.every(id => profile.interests.some(item => item.id===id))));
  const topicCount = (await admin.query("select count(*)::int as n from member_topic_scores where member_id='alice' and source='explicit'")).rows[0].n;
  assert.equal(topicCount,2);
  const profileRequest = body => new Request('https://test.invalid/api/me/profile',{method:'POST',body:JSON.stringify(body)});
  globalThis.__alelmMemberId='alice';
  assert.equal((await withDb(() => subject.profileApi(profileRequest({action:'personalization',enabled:false,expectedMemberId:'bob'})))).status,409);
  assert.equal((await withDb(() => subject.profileApi(profileRequest({action:'personalization',enabled:false,expectedMemberId:'alice'})))).status,200);
  await withDb(() => subject.saveMemberInterests('alice',['health']));
  assert.equal((await withDb(() => subject.getMemberProfile('alice'))).personalizationEnabled,false);
  await admin.query("insert into member_topic_scores(member_id,topic_key,kind,source,weight,updated_at) values('alice','section:test','section','inferred',10,$1)",[new Date().toISOString()]);
  assert.equal((await withDb(() => subject.profileApi(profileRequest({action:'clear-behavior',expectedMemberId:'alice'})))).status,200);
  assert.equal((await admin.query("select count(*)::int as n from member_topic_scores where member_id='alice'")).rows[0].n,1);
  assert.equal(await withDb(() => subject.getSaved('alice','original')),true); checks++;
  for (let i = 0; i < 21; i++) {
    await admin.query("insert into stories(id,slug,title,section,status,keywords,published_at) values($1,$1,$1,'technology','published',$2,$3)", [`keyword-${String(i).padStart(2, '0')}`, JSON.stringify(i === 0 ? [' التقنية ', 'التقنية'] : ['التقنية']), `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`]);
  }
  await admin.query("insert into stories(id,slug,title,section,status,keywords) values('keyword-draft','draft','التقنية','technology','draft','[\"التقنية\"]'),('keyword-title','title','التقنية','technology','published','[\"تقنية أخرى\"]'),('keyword-bad','bad','التقنية','technology','published','{}')");
  const firstKeywordPage = await withDb(() => subject.pageByKeyword('التقنية', '1'));
  const secondKeywordPage = await withDb(() => subject.pageByKeyword('التقنية', '2'));
  assert.equal(firstKeywordPage.total, 21);
  assert.equal(firstKeywordPage.items.length, 18);
  assert.equal(firstKeywordPage.items[0].id, 'keyword-20');
  assert.equal(secondKeywordPage.items.length, 3);
  assert.equal(new Set([...firstKeywordPage.items, ...secondKeywordPage.items].map(item => item.id)).size, 21);
  assert.equal((await withDb(() => subject.pageByKeyword("%' OR true --", '1'))).total, 0);
  assert.equal((await withDb(() => subject.pageByKeyword('التقنية', '999'))).page, 2);
  checks++;
  console.log(`PostgreSQL workflow integration: ${checks} checks passed (including concurrent publish and shared limits).`);
} finally {
  await admin.end();
  await rm(directory, { recursive: true, force: true });
}
