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
  await admin.query("truncate user_permissions, role_permissions, roles, stories, story_slides, jak_sources, story_versions, audit_log, request_limits, ai_usage, ai_settings, users, member_saved_stories, member_likes, newsletter_subscribers, member_profiles, interests, member_interests, member_topic_scores, member_story_stats, member_events cascade");
  await build({
    stdin: { contents: `export {setTaxonomyHidden,loadTaxonomyVisibility,loadEditorialTaxonomy} from './lib/content/taxonomy-settings'; export { POST as storySaveApi } from './app/api/tahrir/story/route'; export { POST as loginApi } from './app/api/tahrir/login/route'; export { GET as healthApi } from './app/api/health/route'; export * from './lib/tahrir/service'; export { replaceSlides } from './lib/tahrir/jak'; export * from './lib/tahrir/workflow'; export * from './lib/tahrir/write-policy'; export { consumeLimit } from './lib/tahrir/rate-limit'; export * from './lib/ai/usage'; export { invalidateAiSettingsCache } from './lib/ai/settings'; export * from './lib/personalization/saved'; export { verifyMfa } from './lib/tahrir/mfa'; export { POST as subscribe } from './app/api/newsletter/route'; export { POST as saveApi } from './app/api/me/saved/route'; export { createMember, changeOwnPassword, resetMemberPassword, validatePassword } from './lib/tahrir/admin'; export * from './lib/tahrir/editorial-team'; export { storyTimeline } from './lib/tahrir/story-timeline'; export { invalidateRoleCache, loadActor } from './lib/tahrir/access'; export { saveMemberInterests, seedInterestCatalog, getMemberProfile } from './lib/membership/profile'; export { POST as profileApi } from './app/api/me/profile/route'; export { pageByKeyword, listSitemapEntries, seedContentProvider as publicContentProvider } from './lib/content/provider';`, resolveDir: process.cwd(), loader: "ts" },
    outfile: `${directory}/subject.mjs`, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-db", setup(builder) {
      builder.onResolve({ filter: /^next\/cache$/ }, () => ({ path: "cache", namespace: "test" }));
      builder.onResolve({ filter: /^next\/server$/ }, () => ({ path: "next/server.js", external: true }));
      builder.onResolve({ filter: /^@\/lib\/tahrir\/auth$/ }, () => ({ path: `${process.cwd()}/lib/tahrir/crypto.ts` }));
      builder.onResolve({ filter: /^(?:@\/lib\/db|\.\.\/db\.ts)$/ }, () => ({ path: "db", namespace: "test" }));
      builder.onResolve({ filter: /^@\/lib\/personalization\/session$/ }, () => ({ path: "session", namespace: "test" }));
      builder.onResolve({ filter: /^@\/lib\/content\/provider$/ }, () => ({ path: "provider", namespace: "test" }));
      builder.onResolve({ filter: /^\.\/auth$/ }, args => args.importer.endsWith('/access.ts') ? ({ path: "auth", namespace: "test" }) : undefined);
      builder.onLoad({ filter: /.*/, namespace: "test" }, args => ({ contents: ({
        cache: "export const unstable_cache = load => load; export function revalidateTag(){} export function revalidatePath(path){globalThis.__revalidatedPaths?.push(path)}",
        db: "export function getDb(){return globalThis.__alelmDb.getStore()}",
        session: "export async function getSessionMemberId(){return globalThis.__alelmMemberId ?? null} export function privateJson(value,status=200){return Response.json(value,{status})}",
        provider: "export const seedContentProvider={getStory:async id=>id==='original'?{id}:null}; export function invalidateCorpus(){globalThis.__corpusInvalidations=(globalThis.__corpusInvalidations??0)+1}",
        auth: "export async function getSession(){return globalThis.__alelmSession ?? null}",
      })[args.path], loader: "js" }));
    } }],
  });
  const subject = await import(`../${directory}/subject.mjs`);
  await admin.query("insert into ai_settings(id,data,updated_at) values ('main', $1, 'now')", [JSON.stringify({models:{editorial:'configured-model'},caps:{dailyUsd:17}})]);
  subject.invalidateAiSettingsCache(); // الكتابة المباشرة تتجاوز كاش الإعدادات داخل العملية
  await Promise.all([
    withDb(()=>subject.setTaxonomyHidden('section','sciences',true)),
    withDb(()=>subject.setTaxonomyHidden('series','limatha',true)),
  ]);
  await withDb(async()=>{
    const visibility=await subject.loadTaxonomyVisibility();
    assert.equal(visibility['section:sciences'],true);
    assert.equal(visibility['series:limatha'],true);
    const taxonomy=await subject.loadEditorialTaxonomy();
    assert.ok(!taxonomy.sections.some(item=>item.slug==='sciences'));
    assert.ok(!taxonomy.series.some(item=>item.slug==='limatha'));
    await subject.setTaxonomyHidden('section','sciences',false);
    assert.ok((await subject.loadEditorialTaxonomy()).sections.some(item=>item.slug==='sciences'));
    await assert.rejects(subject.setTaxonomyHidden('section','news',true),/إبقاؤه ظاهرًا/);
    await assert.rejects(subject.setTaxonomyHidden('section','invented',true),/غير معروف/);
  });
  assert.deepEqual((await admin.query("select data from ai_settings where id='main'")).rows[0].data,{models:{editorial:'configured-model'},caps:{dailyUsd:17}});
  await admin.query("delete from ai_settings");
  subject.invalidateAiSettingsCache();
  checks++;
  // Reproduce a deployed content database that predates editorial workflow columns.
  // The temporary table is confined to this isolated connection and shadows public.stories.
  await withDb(async () => {
    const client = context.getStore().$client;
    await client.query("create temporary table stories (like public.stories including defaults)");
    await client.query("alter table pg_temp.stories drop column author_id, drop column version, drop column revision_of, drop column base_version");
    await client.query("insert into pg_temp.stories (id,slug,section,title,body,status) values ('legacy-public','legacy-public','health','Existing article','Full published body','published'), ('legacy-archived','legacy-archived','health','Archived article','Hidden body','archived')");
    const story = await subject.publicContentProvider.getStory('legacy-public');
    assert.equal(story?.title, 'Existing article');
    assert.equal(story?.body, 'Full published body');
    assert.equal(await subject.publicContentProvider.getStory('legacy-archived'), null);
    assert.equal(await subject.publicContentProvider.getStory('legacy-missing'), null);
    checks++;
  });
  // Sitemap cache chunks must preserve every published URL across page boundaries.
  await withDb(async () => {
    const client = context.getStore().$client;
    await client.query("create temporary table stories (like public.stories including defaults)");
    await client.query(`insert into pg_temp.stories (id,slug,section,title,body,status,published_at)
      select 'sitemap-' || lpad(i::text, 5, '0'), 'slug-' || i, 'health', 'Fixture', '',
        case when i=2106 then 'draft' else 'published' end, '2026-09-01T00:00:00.000Z'
      from generate_series(1,2106) i`);
    await client.query(`insert into pg_temp.stories (id,slug,section,title,body,status,published_at)
      values ('1658','duplicate','world','Preserved duplicate','','published','2021-06-08T11:22:57Z'),
             ('1660','original','world','Canonical article','','published','2021-06-07T14:39:11Z')`);
    const entries = await subject.listSitemapEntries();
    assert.equal(entries.length, 2106);
    assert.equal(new Set(entries.map(entry => entry.id)).size, 2106);
    assert.equal(entries[0].id, 'sitemap-00001');
    assert.equal(entries.at(-1).id, '1660');
    assert.equal(entries.some(entry => entry.id === '1658'), false);
    assert.equal((await client.query("select count(*)::int as count from pg_temp.stories where id in ('1658','1660')")).rows[0].count, 2);
    checks++;
  });
  // Exercise the real login handler and signed session against the migrated database.
  const { hashPassword, readSessionToken, SESSION_COOKIE } = await import('../lib/tahrir/crypto.ts');
  process.env.AUTH_SECRET = 'isolated-integration-session-secret';
  await admin.query("insert into roles(id,label,created_at,updated_at) values('login-test-role','Login fixture role',now(),now()) on conflict do nothing");
  await admin.query("insert into users(id,username,display_name,password_hash,created_at) values($1,$2,$3,$4,$5)", ['login-fixture','Login-Fixture','Local fixture',await hashPassword('fixture-password-123'),new Date().toISOString()]);
  const loginRequest = (password, username = 'login-fixture') => new Request('https://test.invalid/api/tahrir/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  // Brute-force lockout (removed in #111, restored): 10 attempts per account and 40 per network every 15 minutes.
  await admin.query("insert into users(id,username,display_name,password_hash,created_at) values($1,$2,$3,$4,$5)", ['lockout-fixture','lockout-fixture','Lockout fixture',await hashPassword('fixture-password-123'),new Date().toISOString()]);
  const lockoutRequest = (password, ip = '203.0.113.7', username = 'lockout-fixture') => new Request('https://test.invalid/api/tahrir/login', {method:'POST',headers:{'Content-Type':'application/json','x-forwarded-for':`${ip}, 10.0.0.1`},body:JSON.stringify({username,password})});
  const lockoutAttempt = (...args) => withDb(() => subject.loginApi(lockoutRequest(...args)));
  for (let attempt = 0; attempt < 10; attempt++) assert.equal((await lockoutAttempt('wrong-password')).status, 401, `attempt ${attempt + 1} is still evaluated`);
  const locked = await lockoutAttempt('wrong-password');
  assert.equal(locked.status, 429, 'the 11th attempt is refused');
  assert.equal(locked.headers.get('Retry-After'), '900');
  assert.equal((await lockoutAttempt('fixture-password-123')).status, 429, 'the correct password is refused while the window is open');
  assert.equal((await lockoutAttempt('fixture-password-123', '203.0.113.7', ' LOCKOUT-Fixture ')).status, 429, 'the account window ignores case and whitespace');
  assert.equal((await admin.query("select count(*)::int n from audit_log where action='login:failed' and actor='lockout-fixture' and detail='كلمة مرور غير صحيحة'")).rows[0].n, 10, 'every evaluated failure is audited, refused attempts are not');
  assert.equal((await admin.query("select count(*)::int n from audit_log where detail like '%wrong-password%' or detail like '%fixture-password%'")).rows[0].n, 0, 'passwords never reach the audit log');
  await admin.query("update request_limits set expires_at=$1", [new Date(Date.now() - 1000).toISOString()]);
  assert.equal((await lockoutAttempt('fixture-password-123')).status, 200, 'an expired window starts afresh');
  // A successful login clears the account window, so the next ten failures are evaluated again before the lockout.
  for (let attempt = 0; attempt < 10; attempt++) assert.equal((await lockoutAttempt('wrong-password')).status, 401);
  assert.equal((await lockoutAttempt('wrong-password')).status, 429);
  // The network window covers unknown usernames too, so distributed guessing from one address is throttled.
  for (let attempt = 0; attempt < 40; attempt++) assert.equal((await lockoutAttempt('wrong-password', '198.51.100.9', `ghost-${attempt}`)).status, 401);
  assert.equal((await lockoutAttempt('fixture-password-123', '198.51.100.9', 'login-fixture')).status, 429, 'the network limit applies to a valid account from the same address');
  assert.equal((await admin.query("select count(*)::int n from audit_log where action='login:failed' and actor='anonymous' and detail='حساب غير معروف'")).rows[0].n, 40, 'unknown accounts are audited under a generic actor');
  const unknownAccount = await lockoutAttempt('wrong-password', '203.0.113.8', 'nobody-here');
  assert.equal(unknownAccount.status, 401);
  assert.deepEqual(await unknownAccount.json(), { error: 'بيانات الدخول غير صحيحة.' }, 'unknown and wrong-password answers are identical');
  assert.equal((await context.run(null, () => subject.loginApi(lockoutRequest('fixture-password-123')))).status, 503, 'an unavailable limiter fails closed');
  checks++;
  assert.equal((await withDb(() => subject.loginApi(loginRequest('wrong-password')))).status,401);
  for (const password of ['FIXTURE-PASSWORD-123', ' fixture-password-123 ']) {
    assert.equal((await withDb(() => subject.loginApi(loginRequest(password)))).status, 401, 'passwords must remain case- and whitespace-sensitive');
  }
  for (const username of ['Login-Fixture', 'LOGIN-FIXTURE', ' \tLoGiN-FiXtUrE\n ']) {
    const response = await withDb(() => subject.loginApi(loginRequest('fixture-password-123', username)));
    assert.equal(response.status, 200);
    const value = response.headers.get('Set-Cookie').split(';')[0].slice(SESSION_COOKIE.length + 1);
    const session = await readSessionToken(value);
    assert.equal(session.userId, 'login-fixture');
    assert.equal(session.username, 'Login-Fixture', 'stored identity and session claims stay intact');
  }
  assert.equal(await withDb(() => subject.findUser('login-fixtur_')), null);
  assert.equal(await withDb(() => subject.findUser('login-%')), null);
  checks++;
  const loggedIn = await withDb(() => subject.loginApi(loginRequest('fixture-password-123')));
  assert.equal(loggedIn.status,200);
  const cookie = loggedIn.headers.get('Set-Cookie');
  assert.ok(cookie?.includes('HttpOnly'));
  assert.ok(cookie?.includes('SameSite=Lax'));
  const token = cookie.split(';')[0].slice(SESSION_COOKIE.length+1);
  globalThis.__alelmSession = await readSessionToken(token);
  assert.equal(globalThis.__alelmSession?.sessionVersion,1);
  assert.equal((await withDb(() => subject.loadActor()))?.userId,'login-fixture');
  await admin.query("update users set session_version=session_version+1 where id='login-fixture'");
  assert.equal(await withDb(() => subject.loadActor()),null);
  checks++;
  await admin.query("update users set mfa_secret='requires-verification' where id='login-fixture'");
  const mfaLogin = await withDb(() => subject.loginApi(loginRequest('fixture-password-123')));
  assert.equal(mfaLogin.status,401);
  assert.equal((await mfaLogin.json()).mfaRequired,true);
  assert.equal(mfaLogin.headers.get('Set-Cookie'),null);
  checks++;
  // Enforce one normalized identity in both the service and the database, including races.
  const newMember = username => ({ username, displayName: 'Test member', email: '', role: 'login-test-role', password: 'fixture-password-123' });
  const duplicate = error => error.status === 409 && error.message === 'اسم المستخدم مستعمل.';
  const superActor = { userId: 'test-admin', username: 'test', permissions: new Set(['*']) };
  await assert.rejects(withDb(() => subject.createMember(newMember(' LOGIN-fixture '), superActor)), duplicate);
  const attempts = await Promise.allSettled([' Concurrent.Identity ', 'concurrent.identity'].map(username => withDb(() => subject.createMember(newMember(username), superActor))));
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
  assert.ok(duplicate(attempts.find(result => result.status === 'rejected').reason));
  assert.equal((await admin.query("select count(*)::int n from users where lower(btrim(username))='concurrent.identity'")).rows[0].n, 1);
  assert.equal((await admin.query("select count(*)::int n from audit_log where action='users:create'")).rows[0].n, 1);
  await assert.rejects(admin.query("insert into users(id,username,display_name,password_hash,created_at) values('duplicate',' LOGIN-FIXTURE ','Fixture','unused',now())"), error => error.code === '23505');
  await admin.query("insert into users(id,username,display_name,password_hash,created_at) values('padded',' Legacy.Name ','Fixture','unused',now())");
  assert.equal((await withDb(() => subject.findUser('legacy.name'))).id, 'padded');
  await assert.rejects(admin.query("update users set username='login-FIXTURE' where id='padded'"), error => error.code === '23505');
  await withDb(async () => {
    const client = context.getStore().$client;
    await client.query('begin');
    try {
      await client.query('drop index users_username_normalized_uidx');
      await client.query("insert into users(id,username,display_name,password_hash,created_at) values('ambiguous','LOGIN-FIXTURE','Fixture','unused',now())");
      await assert.rejects(subject.findUser('login-fixture'), /AMBIGUOUS_USERNAME/);
    } finally { await client.query('rollback'); }
  });
  checks++;
  assert.equal((await withDb(() => subject.healthApi())).status,200);
  await withDb(async () => {
    const client = context.getStore().$client;
    await client.query('begin');
    try {
      await client.query('drop function public.alelm_reserve_ai(text,integer,integer,integer)');
      const unhealthy = await subject.healthApi();
      assert.equal(unhealthy.status,503);
      assert.deepEqual(await unhealthy.json(),{ok:false});
    } finally { await client.query('rollback'); }
  });
  assert.equal((await withDb(() => subject.healthApi())).status,200);
  checks++;
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
  const denied = await withDb(() => subject.budgetGate({ dailyUsd: 1, monthlyUsd: 1 }, 50));
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /الحجز المطلوب 0.50 دولار/);
  assert.match(denied.reason, /المتاح اليوم 0.35 دولار/);
  assert.match(denied.reason, /حجوزات غير مسوّاة بقيمة 0.60 دولار/);
  assert.equal((await admin.query("select sum(cost_cents)::int as n from ai_usage")).rows[0].n, 65);
  await assert.rejects(withDb(() => subject.logUsage({ reservationId: accepted.reservationId, tool: "test", model: "test", inputTokens: 1, outputTokens: 1, costCents: 0, actor: "test" })), /ALREADY_SETTLED/); checks++;
  // Unmeasured transport is retained, while explicit rejection releases its reservation exactly once.
  const open = reservations.filter(r => r.ok && r.reservationId !== accepted.reservationId);
  await withDb(() => subject.logUsage({ reservationId: open[0].reservationId, tool: "full_edit:unmeasured", model: "test", inputTokens: 2, outputTokens: 3, costCents: 12, actor: "test" }));
  await withDb(() => subject.logUsage({ reservationId: open[1].reservationId, tool: "full_edit:failed", model: "test", inputTokens: 0, outputTokens: 0, costCents: 0, actor: "test" }));
  assert.equal((await admin.query("select sum(cost_cents)::int as n from ai_usage")).rows[0].n, 17);
  const uncertainDenied = await withDb(() => subject.budgetGate({ dailyUsd: 1, monthlyUsd: 1 }, 90));
  assert.match(uncertainDenied.reason, /حجوزات غير مسوّاة بقيمة 0.12 دولار/);
  await assert.rejects(withDb(() => subject.logUsage({ reservationId: open[0].reservationId, tool: "full_edit", model: "test", inputTokens: 0, outputTokens: 0, costCents: 0, actor: "test" })), /ALREADY_SETTLED/); checks++;
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
  await withDb(() => subject.resetMemberPassword(oldUser.id, 'reset-password-123', { userId: 'admin', username: 'admin', permissions: new Set(['*']) }));
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
  subject.invalidateAiSettingsCache();
  const stale = await withDb(() => subject.getStory(restored.id));
  await withDb(() => subject.scheduleStory(stale,'2000-01-01T00:00:00.000Z','publisher'));
  await admin.query("update stories set version=version+1 where id='original'");
  await withDb(() => subject.promoteDueScheduled());
  const returned = await withDb(() => subject.getStory(stale.id));
  assert.equal(returned.status,'review'); assert.equal(returned.scheduledAt,null);
  await withDb(() => subject.promoteDueScheduled());
  assert.equal((await admin.query("select count(*)::int as n from audit_log where action='schedule:conflict'")).rows[0].n,1); checks++;
  // Multiple scheduler processes may overlap during deployment; publish each due story once.
  await admin.query("insert into stories(id,slug,title,section,status,scheduled_at) values ('scheduler-due','scheduler-due','مادة مستحقة','news','scheduled','2000-01-01T00:00:00.000Z'), ('scheduler-future','scheduler-future','مادة مستقبلية','news','scheduled','2099-01-01T00:00:00.000Z')");
  const ticks = await Promise.all([withDb(() => subject.promoteDueScheduled()), withDb(() => subject.promoteDueScheduled())]);
  assert.equal(ticks.flat().filter(row => row.id === 'scheduler-due').length, 1);
  assert.equal((await withDb(() => subject.getStory('scheduler-due'))).status, 'published');
  assert.equal((await withDb(() => subject.getStory('scheduler-future'))).status, 'scheduled');
  assert.deepEqual(await withDb(() => subject.promoteDueScheduled()), []);
  assert.equal((await admin.query("select count(*)::int as n from audit_log where action='status:published' and story_id='scheduler-due'")).rows[0].n, 1); checks++;
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
  // Autosave uses the same permission/version guards, creates once, and never changes published content.
  const priorSession = globalThis.__alelmSession;
  await admin.query("insert into user_permissions(user_id,permission_key,effect) values('login-fixture','story.create','allow'),('login-fixture','story.edit.own','allow') on conflict do nothing");
  const autoUser = (await admin.query("select id,session_version from users where id='login-fixture'")).rows[0];
  globalThis.__alelmSession = { userId: autoUser.id, sessionVersion: autoUser.session_version };
  const autoRequest = value => new Request('https://test.invalid/api/tahrir/story',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
  const autoInput = {id:'autosave-draft',expectedVersion:0,title:'',body:'متن قبل توليد العنوان',autosave:true};
  const createdAuto = await withDb(()=>subject.storySaveApi(autoRequest(autoInput)));
  assert.equal(createdAuto.status,200); const autoData=await createdAuto.json();
  assert.equal(autoData.version,1); assert.equal(autoData.status,'draft');
  assert.equal((await withDb(()=>subject.storySaveApi(autoRequest(autoInput)))).status,409);
  assert.equal((await admin.query("select count(*)::int n from stories where id='autosave-draft'")).rows[0].n,1);
  assert.equal((await withDb(()=>subject.storySaveApi(autoRequest({...autoInput,autosave:false,expectedVersion:1})))).status,400);
  const updatedAuto=await withDb(()=>subject.storySaveApi(autoRequest({...autoInput,expectedVersion:1,title:'عنوان بعد التوليد',section:'health',slug:'draft-completed'})));
  assert.equal(updatedAuto.status,200);
  const updatedAutoData=await updatedAuto.json();assert.equal(updatedAutoData.section,'health');assert.equal(updatedAutoData.slug,'draft-completed');
  await admin.query("update stories set status='published' where id='autosave-draft'");
  assert.equal((await withDb(()=>subject.storySaveApi(autoRequest({...autoInput,expectedVersion:2,title:'لا يطبق تلقائيا'})))).status,409);
  assert.equal((await withDb(()=>subject.getStory('autosave-draft'))).title,'عنوان بعد التوليد');
  const autoAudit = (await admin.query("select action,context from audit_log where story_id='autosave-draft' order by at,id")).rows;
  assert.equal(autoAudit.length, 2, 'rejected or conflicting saves must never create successful audit events');
  const autoSaveAudit = autoAudit.find(row=>row.action==='draft:save').context;
  assert.equal(autoSaveAudit.saveMode,'automatic');
  assert.equal(autoSaveAudit.actorName,'Local fixture');
  assert.deepEqual(autoSaveAudit.changes.find(change=>change.field==='title'),{field:'title',label:'العنوان',before:'',after:'عنوان بعد التوليد'});
  // Returning to draft saves current edits on the original, with permissions, history and cache invalidation.
  const unpublishInput = {...autoInput, autosave:false, returnToDraft:true, expectedVersion:2, title:'تعديلات محفوظة بعد سحب النشر', slug:'must-not-change', section:'world'};
  assert.equal((await withDb(()=>subject.storySaveApi(autoRequest(unpublishInput)))).status,403);
  const publisher = {...editor, can:key=>editor.can(key)||key==='story.publish'};
  const latestOriginal=await withDb(()=>subject.getStory(input.id));
  await assert.rejects(withDb(()=>subject.saveDraft({...input,returnToDraft:true,expectedVersion:latestOriginal.version},editor)), /صلاحية/);
  const ineligible=await withDb(()=>subject.saveDraft({...input,id:'unpublish-ineligible'},editor));
  await assert.rejects(withDb(()=>subject.saveDraft({...input,id:ineligible.id,returnToDraft:true,expectedVersion:ineligible.version},publisher)), /المنشورة فقط/);
  await admin.query("insert into user_permissions(user_id,permission_key,effect) values('login-fixture','story.publish','allow')");
  assert.equal((await withDb(()=>subject.storySaveApi(autoRequest({...unpublishInput,autosave:true})))).status,400);
  assert.equal((await withDb(()=>subject.storySaveApi(autoRequest({...unpublishInput,expectedVersion:1})))).status,409);
  const oldPublished = await withDb(()=>subject.getStory('autosave-draft'));
  globalThis.__revalidatedPaths=[];
  const invalidationsBefore=globalThis.__corpusInvalidations??0;
  const unpublishResponse=await withDb(()=>subject.storySaveApi(autoRequest(unpublishInput)));
  assert.equal(unpublishResponse.status,200);
  const unpublished=await unpublishResponse.json();
  assert.equal(unpublished.id,'autosave-draft');assert.equal(unpublished.status,'draft');assert.equal(unpublished.version,3);
  const unpublishedRow=await withDb(()=>subject.getStory(unpublished.id));
  assert.equal(unpublishedRow.title,unpublishInput.title);
  for(const key of ['slug','section','authorId','authorName','publishedAt']) assert.equal(unpublishedRow[key],oldPublished[key]);
  assert.equal(unpublishedRow.scheduledAt,null);assert.equal(unpublishedRow.revisionOf,null);
  assert.equal(await withDb(()=>subject.publicContentProvider.getStory(unpublished.id)),null);
  const previous=(await admin.query("select data from story_versions where story_id='autosave-draft'")).rows;
  assert.equal(previous.length,1);assert.equal(previous[0].data.story.title,oldPublished.title);
  assert.equal(previous[0].data.story.status,'published');
  assert.equal((await admin.query("select count(*)::int n from audit_log where story_id='autosave-draft' and action='story:unpublish'")).rows[0].n,1);
  assert.ok(globalThis.__revalidatedPaths.includes('/health/autosave-draft/draft-completed'));
  assert.equal(globalThis.__corpusInvalidations,invalidationsBefore+1);
  assert.equal((await withDb(()=>subject.storySaveApi(autoRequest({...unpublishInput,expectedVersion:3})))).status,409);
  const republished=await withDb(()=>subject.publishCheckedStory(unpublishedRow,'publisher','republish test'));
  assert.equal(republished.id,unpublished.id);
  assert.equal((await withDb(()=>subject.getStory(unpublished.id))).status,'published');
  // Competing writes cannot both withdraw the same version or create duplicate history.
  const competing=await Promise.all([1,2].map(()=>withDb(()=>subject.storySaveApi(autoRequest({...unpublishInput,expectedVersion:republished.version})))));
  assert.deepEqual(competing.map(response=>response.status).sort(),[200,409]);
  assert.equal((await admin.query("select count(*)::int n from story_versions where story_id='autosave-draft'")).rows[0].n,2);
  delete globalThis.__revalidatedPaths;delete globalThis.__corpusInvalidations;
  checks++;
  // Scheduled edits update one original atomically, preserving its exact deadline unless explicitly changed.
  const scheduledInput = {id:'scheduled-edit-fixture',expectedVersion:1,title:'Updated scheduled title',body:'Scheduled body',updateScheduled:true,autosave:false,slug:'must-not-change',section:'world'};
  const originalDeadline = '2030-01-01T22:30:45.123Z';
  await admin.query("insert into stories(id,slug,title,section,status,scheduled_at,author_id,author_name,version) values ('scheduled-edit-fixture','scheduled-original','Original scheduled title','news','scheduled',$1,'login-fixture','Original author',1)",[originalDeadline]);
  assert.equal((await withDb(()=>subject.storySaveApi(autoRequest(scheduledInput)))).status,403);
  await admin.query("insert into user_permissions(user_id,permission_key,effect) values('login-fixture','story.schedule','allow')");
  assert.equal((await withDb(()=>subject.storySaveApi(autoRequest({...scheduledInput,autosave:true})))).status,409);
  const scheduledResponse=await withDb(()=>subject.storySaveApi(autoRequest(scheduledInput)));
  assert.equal(scheduledResponse.status,200);const savedScheduled=await scheduledResponse.json();
  assert.equal(savedScheduled.id,scheduledInput.id);assert.equal(savedScheduled.status,'scheduled');assert.equal(savedScheduled.revisionOf,null);assert.equal(savedScheduled.version,2);assert.equal(savedScheduled.scheduledAt,originalDeadline);
  let persistedScheduled=await withDb(()=>subject.getStory(scheduledInput.id));
  assert.equal(persistedScheduled.title,scheduledInput.title);assert.equal(persistedScheduled.scheduledAt,originalDeadline);
  assert.equal(persistedScheduled.slug,'scheduled-original');assert.equal(persistedScheduled.section,'news');assert.equal(persistedScheduled.authorName,'Original author');
  assert.equal((await admin.query("select count(*)::int n from stories where revision_of='scheduled-edit-fixture'")).rows[0].n,0);
  assert.equal((await admin.query("select count(*)::int n from story_versions where story_id='scheduled-edit-fixture'")).rows[0].n,1);
  assert.equal((await admin.query("select count(*)::int n from audit_log where story_id='scheduled-edit-fixture' and action='scheduled:update'")).rows[0].n,1);
  assert.equal((await withDb(()=>subject.storySaveApi(autoRequest(scheduledInput)))).status,409);
  for(const invalid of ['', 'bad', '2000-01-01T00:00:00Z']) assert.equal((await withDb(()=>subject.storySaveApi(autoRequest({...scheduledInput,expectedVersion:2,rescheduleAt:invalid})))).status,400);
  const rescheduled=await withDb(()=>subject.storySaveApi(autoRequest({...scheduledInput,expectedVersion:2,rescheduleAt:'2030-02-01T15:00:00+03:00'})));
  assert.equal(rescheduled.status,200);assert.equal((await rescheduled.json()).scheduledAt,'2030-02-01T12:00:00.000Z');
  const competingScheduled=await Promise.all([1,2].map(i=>withDb(()=>subject.storySaveApi(autoRequest({...scheduledInput,expectedVersion:3,title:`Scheduled contender ${i}`})))));
  assert.deepEqual(competingScheduled.map(response=>response.status).sort(),[200,409]);
  persistedScheduled=await withDb(()=>subject.getStory(scheduledInput.id));assert.equal(persistedScheduled.version,4);assert.equal(persistedScheduled.status,'scheduled');assert.equal(persistedScheduled.scheduledAt,'2030-02-01T12:00:00.000Z');
  const priorSettings=(await admin.query("select data from ai_settings where id='main'")).rows[0].data;
  await admin.query("update ai_settings set data=$1 where id='main'",[JSON.stringify({governance:{editorialGuard:true,requireImageRights:true}})]);subject.invalidateAiSettingsCache();
  assert.equal((await withDb(()=>subject.storySaveApi(autoRequest({...scheduledInput,expectedVersion:4,body:''})))).status,422);
  assert.equal((await withDb(()=>subject.getStory(scheduledInput.id))).version,4);
  await admin.query("update ai_settings set data=$1 where id='main'",[JSON.stringify(priorSettings)]);subject.invalidateAiSettingsCache();
  await admin.query("update stories set status='published',version=5,scheduled_at=null where id='scheduled-edit-fixture'");
  assert.equal((await withDb(()=>subject.storySaveApi(autoRequest({...scheduledInput,expectedVersion:5})))).status,409);
  checks++;
  globalThis.__alelmSession = priorSession; checks++;
  // Editorial collaboration uses real transactions, live assignment permissions and private notices.
  await admin.query(`insert into roles(id,label,description,created_at,updated_at) values ('team_editor','محرر اختبار','test',now()::text,now()::text) on conflict do nothing`);
  await admin.query(`insert into role_permissions(role_id,permission_key) values ('team_editor','story.edit.own') on conflict do nothing`);
  for (const id of ['team-owner','team-assignee','team-outsider']) await admin.query(`insert into users(id,username,display_name,password_hash,role,created_at) values ($1,$1,$1,'not-a-login','team_editor',now()::text)`,[id]);
  subject.invalidateRoleCache();
  const teamActor = id => ({ ...editor, userId:id, username:id, displayName:id });
  const manager = { ...teamActor('manager'), can: () => true };
  const owner = teamActor('team-owner'), assignee = teamActor('team-assignee'), outsider = teamActor('team-outsider');
  const teamDraft = { id:'team-draft', title:'مادة تجريبية للتعاون', body:'متن للمراجعة', excerpt:'موجز', section:'news', seriesSlug:null, image:null };
  await withDb(()=>subject.saveDraft(teamDraft,owner));
  await assert.rejects(withDb(()=>subject.readTeam(teamDraft.id,outsider)), error=>error.status===403);
  await assert.rejects(withDb(()=>subject.changeTeam(teamDraft.id,owner,{action:'assign',assignedTo:assignee.userId,dueAt:null,expectedVersion:1})), error=>error.status===403);
  await assert.rejects(withDb(()=>subject.changeTeam(teamDraft.id,manager,{action:'assign',assignedTo:'missing',dueAt:null,expectedVersion:1})), error=>error.status===400);
  const assignment = {action:'assign',assignedTo:assignee.userId,dueAt:'2026-09-09T09:00:00.000Z',expectedVersion:1};
  const assigned = await withDb(()=>subject.changeTeam(teamDraft.id,manager,assignment));
  assert.deepEqual(assigned.assignment, { assignedTo: assignee.userId, assigneeName: assignee.displayName, dueAt: assignment.dueAt });
  const team = await withDb(()=>subject.readTeam(teamDraft.id,assignee));
  assert.equal(team.assignedTo,assignee.userId); assert.equal(team.version,2);
  assert.equal((await withDb(()=>subject.myNotifications(assignee))).length,1);
  assert.equal((await withDb(()=>subject.myNotifications(outsider))).length,0);
  await assert.rejects(withDb(()=>subject.changeTeam(teamDraft.id,manager,assignment)),error=>error.status===409);
  // Assignment changes an internal workflow version, not the public lastmod.
  const publicModified = '2026-08-01T12:00:00.000Z';
  const assignmentPublicId = 'assignment-public';
  await withDb(()=>subject.saveDraft({...teamDraft,id:assignmentPublicId},owner));
  await admin.query("update stories set status='published',published_at=$2,updated_at=$2 where id=$1", [assignmentPublicId, publicModified]);
  const assignedPublished = await withDb(()=>subject.changeTeam(assignmentPublicId,manager,{...assignment,expectedVersion:1,assignedTo:null}));
  assert.equal(assignedPublished.version,2);
  assert.equal((await admin.query('select updated_at from stories where id=$1',[assignmentPublicId])).rows[0].updated_at,publicModified);

  // The assigned editor can save without acquiring access to other authors' stories.
  await withDb(()=>subject.saveDraft({...teamDraft,expectedVersion:2,body:'تعديل المحرر المسند'},assignee));
  await withDb(()=>subject.saveDraft({...teamDraft,id:'team-private'},owner));
  await assert.rejects(withDb(()=>subject.saveDraft({...teamDraft,id:'team-private',expectedVersion:1},assignee)),error=>error.status===403);
  await withDb(()=>subject.changeTeam(teamDraft.id,assignee,{action:'comment',body:'راجع المصدر الرسمي قبل النشر https://example.org/source'}));
  assert.equal((await withDb(()=>subject.readTeam(teamDraft.id,owner))).notes.length,1);
  assert.equal((await withDb(()=>subject.myNotifications(owner))).length,1);
  checks++;
  let teamStory = await withDb(()=>subject.getStory(teamDraft.id));
  await withDb(()=>subject.setStatus(teamStory,'review',owner.username));
  const returnInput={action:'return',body:'راجع الأرقام الواردة في الفقرة الثانية.',expectedVersion:4};
  await assert.rejects(withDb(()=>subject.changeTeam(teamDraft.id,assignee,returnInput)),error=>error.status===403);
  const returnAttempts = await Promise.allSettled([1,2].map(()=>withDb(()=>subject.changeTeam(teamDraft.id,manager,returnInput))));
  assert.equal(returnAttempts.filter(result=>result.status==='fulfilled').length,1);
  teamStory=await withDb(()=>subject.getStory(teamDraft.id));
  assert.equal(teamStory.status,'draft'); assert.ok(teamStory.returnedAt); assert.equal(teamStory.version,5);
  assert.equal((await withDb(()=>subject.readTeam(teamDraft.id,assignee))).notes.filter(note=>note.kind==='return').length,1);
  await assert.rejects(withDb(()=>subject.changeTeam(teamDraft.id,manager,{...returnInput,expectedVersion:5})),error=>error.status===409);
  await withDb(()=>subject.setStatus(teamStory,'review',assignee.username));
  assert.equal((await withDb(()=>subject.getStory(teamDraft.id))).returnedAt,null);
  checks++;
  const ownerSession=crypto.randomUUID(), assigneeSession=crypto.randomUUID();
  assert.deepEqual(await withDb(()=>subject.updatePresence(teamDraft.id,owner,ownerSession)),[]);
  assert.equal((await withDb(()=>subject.updatePresence(teamDraft.id,assignee,assigneeSession)))[0].userId,owner.userId);
  assert.equal((await withDb(()=>subject.updatePresence(teamDraft.id,owner,crypto.randomUUID()))).length,2);
  await assert.rejects(withDb(()=>subject.updatePresence(teamDraft.id,outsider,crypto.randomUUID())),error=>error.status===403);
  await admin.query("update editorial_presence set seen_at=$1",[new Date(Date.now()-80_000).toISOString()]);
  assert.deepEqual(await withDb(()=>subject.updatePresence(teamDraft.id,assignee,assigneeSession)),[]);
  await withDb(()=>subject.leavePresence(outsider,assigneeSession));
  assert.equal((await admin.query("select count(*)::int n from editorial_presence where session_id=$1",[assigneeSession])).rows[0].n,1);
  await withDb(()=>subject.leavePresence(assignee,assigneeSession));
  assert.equal((await admin.query("select count(*)::int n from editorial_presence where session_id=$1",[assigneeSession])).rows[0].n,0);
  // Story timelines retain server identity and field changes, paginate and enforce each revision's permissions.
  const beforeTimeline = (await admin.query("select count(*)::int n from audit_log")).rows[0].n;
  const timeline = await withDb(()=>subject.storyTimeline(teamDraft.id,assignee));
  assert.ok(timeline.events.some(event=>event.action==='story:assign' && event.fields.includes('المحرر المسؤول')));
  assert.ok(timeline.events.every(event=>!('changes' in event)));
  assert.equal((await admin.query("select count(*)::int n from audit_log")).rows[0].n,beforeTimeline);
  const assignedEvent=timeline.events.find(event=>event.action==='story:assign');
  const detail=await withDb(()=>subject.storyTimeline(teamDraft.id,assignee,{eventId:assignedEvent.id}));
  assert.equal(detail.events[0].changes.find(change=>change.field==='assignedTo').after,assignee.userId);
  assert.equal(detail.events[0].references[assignee.userId],'team-assignee');
  await admin.query("update users set display_name='اسم جديد' where id='team-assignee'");
  const renamed=await withDb(()=>subject.storyTimeline(teamDraft.id,assignee));
  assert.equal(renamed.events.find(event=>event.action==='story:comment').actorName,'team-assignee');
  await assert.rejects(withDb(()=>subject.storyTimeline(teamDraft.id,outsider)),error=>error.status===403);
  await assert.rejects(withDb(()=>subject.storyTimeline(teamDraft.id,assignee,{cursor:'malformed'})),error=>error.status===400);
  await admin.query("insert into stories(id,slug,section,title,status,author_id,revision_of) values('timeline-private-revision','private','news','private','draft','team-outsider','team-draft')");
  await withDb(()=>subject.auditQuery(outsider.username,'story:comment','timeline-private-revision','private note'));
  const managerTimeline=await withDb(()=>subject.storyTimeline(teamDraft.id,manager));
  const privateEvent=managerTimeline.events.find(event=>event.detail==='private note');assert.ok(privateEvent);
  const assigneeTimeline=await withDb(()=>subject.storyTimeline(teamDraft.id,assignee));assert.ok(!assigneeTimeline.events.some(event=>event.id===privateEvent.id));
  await assert.rejects(withDb(()=>subject.storyTimeline(teamDraft.id,assignee,{eventId:privateEvent.id})),error=>error.status===404);
  await withDb(()=>subject.deleteDraft('timeline-private-revision',manager.username));
  assert.ok((await withDb(()=>subject.storyTimeline(teamDraft.id,manager))).events.some(event=>event.action==='draft:delete' && event.storyId==='timeline-private-revision'));
  for(let i=0;i<37;i++)await admin.query("insert into audit_log(id,at,actor,action,story_id,detail) values($1,'2027-01-01T00:00:00.000Z','النظام','draft:save','team-draft','legacy')",['timeline-page-'+String(i).padStart(2,'0')]);
  const firstPage=await withDb(()=>subject.storyTimeline(teamDraft.id,manager));assert.equal(firstPage.events.length,30);assert.ok(firstPage.nextCursor);
  const secondPage=await withDb(()=>subject.storyTimeline(teamDraft.id,manager,{cursor:firstPage.nextCursor}));
  assert.equal([...firstPage.events,...secondPage.events].filter(event=>event.id.startsWith('timeline-page-')).length,37);
  assert.equal(new Set([...firstPage.events,...secondPage.events].map(event=>event.id)).size,firstPage.events.length+secondPage.events.length);
  checks++;
  // Revoking an assignment removes both write access and visibility of prior notifications.
  teamStory=await withDb(()=>subject.getStory(teamDraft.id));
  await withDb(()=>subject.changeTeam(teamDraft.id,manager,{...assignment,assignedTo:null,expectedVersion:teamStory.version}));
  await assert.rejects(withDb(()=>subject.readTeam(teamDraft.id,assignee)),error=>error.status===403);
  assert.deepEqual(await withDb(()=>subject.myNotifications(assignee)),[]);
  checks++;
  console.log(`PostgreSQL workflow integration: ${checks} checks passed (including concurrent publish and shared limits).`);
} finally {
  await admin.end();
  await rm(directory, { recursive: true, force: true });
}
