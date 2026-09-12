/**
 * مصفوفة الصلاحيات التنفيذية: كل مسار محكوم يُستدعى فعليًا ضد قاعدة مهاجَرة —
 * 401 بلا جلسة، 403 لدور بلا الصلاحية، وغير 401/403 لدور يحملها — مع إلزام MFA للإدارة،
 * وإبطال الجلسة عند الخروج، وحرس التسلسل الإداري، وبوابة الحارس التحريري عند النشر.
 */
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, readFile, rm } from "node:fs/promises";
import { build } from "esbuild";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !/^alelm_test/.test(new URL(connectionString).pathname.slice(1))) throw new Error("Isolated TEST_DATABASE_URL database named alelm_test* required.");
const admin = new pg.Client({ connectionString });
await admin.connect();
const directory = `tmp/permission-matrix-${process.pid}`;
await mkdir(directory, { recursive: true });
const context = new AsyncLocalStorage();
globalThis.__matrixDb = context;
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
    } catch (error) { await client.query("rollback"); throw error; }
  };
  try { return await context.run(db, fn); } finally { await client.end(); }
}
const count = async (where, params = []) => (await admin.query(`select count(*)::int n from audit_log where ${where}`, params)).rows[0].n;
try {
  await migrate(drizzle(admin), { migrationsFolder: "drizzle" });
  await admin.query("truncate user_permissions, role_permissions, roles, stories, story_slides, jak_sources, story_versions, audit_log, request_limits, ai_usage, ai_settings, users, editorial_notes, editorial_notifications cascade");
  await build({
    stdin: { contents: `
      export { POST as loginApi } from './app/api/tahrir/login/route';
      export { POST as logoutApi } from './app/api/tahrir/logout/route';
      export { POST as mfaApi } from './app/api/tahrir/account/mfa/route';
      export { POST as publishApi } from './app/api/tahrir/story/publish/route';
      export { POST as scheduleApi } from './app/api/tahrir/story/schedule/route';
      export { POST as saveApi } from './app/api/tahrir/story/route';
      export { POST as archiveApi } from './app/api/tahrir/story/archive/route';
      export { POST as restoreApi } from './app/api/tahrir/story/restore/route';
      export { GET as membersGet, POST as membersPost } from './app/api/tahrir/admin/members/route';
      export { PATCH as memberPatch } from './app/api/tahrir/admin/members/[id]/route';
      export { POST as memberPassword } from './app/api/tahrir/admin/members/[id]/password/route';
      export { POST as memberStatus } from './app/api/tahrir/admin/members/[id]/status/route';
      export { PUT as memberOverrides } from './app/api/tahrir/admin/members/[id]/permissions/route';
      export { POST as rolesPost } from './app/api/tahrir/admin/roles/route';
      export { PATCH as rolePermission } from './app/api/tahrir/admin/roles/[id]/permissions/route';
      export { GET as aiSettingsGet, PATCH as aiSettingsPatch } from './app/api/tahrir/ai/settings/route';
      export { PATCH as systemSettingsPatch } from './app/api/tahrir/settings/route';
      export { PATCH as seriesVisibility } from './app/api/tahrir/series/visibility/route';
      export { POST as mediaRights } from './app/api/tahrir/media/rights/route';
      export { PATCH as taxonomyPatch } from './app/api/tahrir/taxonomy/route';
      export { ensureSystemRoles } from './lib/tahrir/admin';
      export { invalidateRoleCache, loadActor } from './lib/tahrir/access';
    `, resolveDir: process.cwd(), loader: "ts" },
    outfile: `${directory}/subject.mjs`, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-matrix", setup(builder) {
      builder.onResolve({ filter: /^next\/cache$/ }, () => ({ path: "cache", namespace: "test" }));
      builder.onResolve({ filter: /^next\/server$/ }, () => ({ path: "next/server.js", external: true }));
      builder.onResolve({ filter: /^@\/lib\/tahrir\/auth$/ }, () => ({ path: "auth", namespace: "test" }));
      builder.onResolve({ filter: /^\.\/auth$/ }, (args) => (args.importer.endsWith("/access.ts") ? { path: "auth", namespace: "test" } : undefined));
      builder.onResolve({ filter: /^(?:@\/lib\/db|\.\.\/db\.ts)$/ }, () => ({ path: "db", namespace: "test" }));
      builder.onResolve({ filter: /^@\/lib\/content\/provider$/ }, () => ({ path: "provider", namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, (args) => ({ loader: "js", resolveDir: process.cwd(), contents: ({
        cache: "export const unstable_cache = load => load; export function revalidateTag(){} export function revalidatePath(){}",
        auth: "export * from './lib/tahrir/crypto.ts'; export async function getSession(){return globalThis.__matrixSession ?? null}",
        db: "export function getDb(){return globalThis.__matrixDb.getStore()}",
        provider: "export const seedContentProvider={getStory:async()=>null}; export function invalidateCorpus(){}",
      })[args.path] }));
    } }],
  });
  const subject = await import(`../${directory}/subject.mjs`);
  const { hashPassword, readSessionToken, SESSION_COOKIE } = await import("../lib/tahrir/crypto.ts");
  const { totp } = await import("../lib/tahrir/totp.ts");
  process.env.AUTH_SECRET = "isolated-matrix-session-secret";
  process.env.TAHRIR_MFA_KEY = "cd".repeat(32); // الإلزام يسري فقط حين يكون المفتاح مضبوطًا.
  process.env.TAHRIR_MFA_ENFORCE = "1"; // والإلزام نفسه اختياري — معطّل افتراضيًا بقرار المالك.

  await withDb(() => subject.ensureSystemRoles());
  subject.invalidateRoleCache();
  const passwordHash = await hashPassword("matrix-password-123");
  const at = new Date().toISOString();
  // مسؤولان بتحقق مفعّل كي لا يتدخل حارس «آخر مسؤول»، ومسؤول بلا تحقق لاختبار الإلزام، وعضو عمليات يحمل صلاحيات الإدارة بلا الشاملة.
  for (const [id, role, mfa] of [["editor-u", "editor", null], ["me-u", "managing_editor", null], ["chief-u", "chief", null], ["admin-u", "admin", "enforced"], ["admin2-u", "admin", "enforced"], ["nomfa-u", "admin", null], ["ops-u", "managing_editor", "enforced"]]) {
    await admin.query("insert into users(id,username,display_name,password_hash,role,mfa_secret,created_at) values($1,$1,$1,$2,$3,$4,$5)", [id, passwordHash, role, mfa, at]);
  }
  await admin.query("insert into user_permissions(user_id,permission_key,effect) values('ops-u','users.manage','allow'),('ops-u','users.suspend','allow'),('ops-u','roles.manage','allow')");
  await admin.query("insert into users(id,username,display_name,password_hash,role,created_at) values('restricted-u','restricted-u','محرر مقيّد',$1,'editor',$2)", [passwordHash, at]);
  await admin.query("insert into user_permissions(user_id,permission_key,effect) values('restricted-u','story.pin','deny'),('restricted-u','story.schedule','deny')");
  const rolesBefore = (await admin.query("select * from role_permissions order by role_id,permission_key")).rows;
  const overridesBefore = (await admin.query("select * from user_permissions order by user_id,permission_key")).rows;
  // A previously seeded editor gains only these two permissions; replay is harmless.
  await admin.query("delete from role_permissions where role_id='editor' and permission_key in ('story.pin','story.schedule')");
  const migration = await readFile('drizzle/0015_editor_pin_schedule.sql', 'utf8');
  await admin.query(migration);
  await admin.query(migration);
  assert.deepEqual((await admin.query("select * from role_permissions order by role_id,permission_key")).rows, rolesBefore);
  assert.deepEqual((await admin.query("select * from user_permissions order by user_id,permission_key")).rows, overridesBefore);
  subject.invalidateRoleCache();
  // متن يتجاوز حد الـ300 كلمة كي لا تعترض قاعدة الطول؛ المخالِف يضيف جملة من قاموس المحاذير (قاعدة قطعية حتمية).
  const sentences = ["تشير الدراسات الحديثة إلى أهمية النوم الكافي في تحسين الصحة العامة والتركيز الذهني لدى البالغين.", "ينصح الأطباء بممارسة المشي نصف ساعة يوميًا للحفاظ على صحة القلب وتنظيم ضغط الدم.", "يساعد شرب الماء بانتظام على تحسين وظائف الكلى وترطيب الجسم خلال أشهر الصيف الحارة.", "تؤكد منظمة الصحة العالمية أن التغذية المتوازنة تقلل مخاطر الإصابة بالأمراض المزمنة على المدى الطويل.", "يوصي المختصون بتقليل السكريات المضافة في النظام الغذائي اليومي للأطفال والكبار على حد سواء."];
  const cleanBody = `<p>${Array.from({ length: 30 }, (_, i) => sentences[i % sentences.length]).join(" ")}</p>`;
  const blockedBody = `${cleanBody}<p>تقرير عن إسرائيل بلا مصدر واس.</p>`;
  await admin.query("insert into stories(id,slug,section,title,body,status,version,author_id) values('clean-story','clean','health','دراسة جديدة توضح أثر النوم على صحة القلب',$1,'review',1,'editor-u'),('blocked-story','blocked','world','دراسة جديدة توضح أثر النوم على صحة القلب',$2,'review',1,'editor-u')", [cleanBody, blockedBody]);

  const json = (method, body) => new Request("https://test.invalid/api/tahrir/matrix", { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const ctx = (id) => ({ params: Promise.resolve({ id }) });
  const as = (userId, sessionVersion = 1) => { globalThis.__matrixSession = userId ? { userId, sessionVersion } : null; };
  const call = (userId, fn) => { as(userId); return withDb(fn); };
  const future = new Date(Date.now() + 86_400_000).toISOString();

  // المصفوفة: [المسار، الاستدعاء، الصلاحية، دور بلا الصلاحية، دور يحملها]
  const matrix = [
    ["story/publish POST", () => subject.publishApi(json("POST", { id: "missing" })), "story.publish", "editor-u", "me-u"],
    ["story/schedule POST", () => subject.scheduleApi(json("POST", { id: "missing", scheduledAt: future })), "story.schedule", "restricted-u", "editor-u"],
    ["story/archive POST", () => subject.archiveApi(json("POST", { id: "missing", reason: "سبب كافٍ للأرشفة" })), "story.archive", "editor-u", "me-u"],
    ["story/restore POST", () => subject.restoreApi(json("POST", { id: "missing" })), "story.restore", "me-u", "chief-u"],
    ["admin/members GET", () => subject.membersGet(), "users.view", "editor-u", "chief-u"],
    ["admin/members POST", () => subject.membersPost(json("POST", {})), "users.manage", "chief-u", "admin-u"],
    ["admin/members/[id] PATCH", () => subject.memberPatch(json("PATCH", { displayName: "اسم" }), ctx("missing")), "users.manage", "chief-u", "admin-u"],
    ["admin/members/[id]/password POST", () => subject.memberPassword(json("POST", { password: "temporary-pass-123" }), ctx("missing")), "users.manage", "chief-u", "admin-u"],
    ["admin/members/[id]/status POST", () => subject.memberStatus(json("POST", { status: "active" }), ctx("missing")), "users.suspend", "chief-u", "admin-u"],
    ["admin/members/[id]/permissions PUT", () => subject.memberOverrides(json("PUT", { overrides: [] }), ctx("missing")), "roles.manage", "chief-u", "admin-u"],
    ["admin/roles POST", () => subject.rolesPost(json("POST", {})), "roles.manage", "chief-u", "admin-u"],
    ["admin/roles/[id]/permissions PATCH", () => subject.rolePermission(json("PATCH", {}), ctx("editor")), "roles.manage", "chief-u", "admin-u"],
    ["ai/settings PATCH", () => subject.aiSettingsPatch(json("PATCH", { tools: {} })), "ai.settings", "me-u", "chief-u"],
    ["settings PATCH", () => subject.systemSettingsPatch(json("PATCH", { governance: {} })), "ai.settings", "me-u", "chief-u"],
    ["series/visibility PATCH", () => subject.seriesVisibility(json("PATCH", {})), "series.visibility", "editor-u", "me-u"],
    ["media/rights POST", () => subject.mediaRights(json("POST", {})), "media.rights", "editor-u", "me-u"],
    ["taxonomy PATCH", () => subject.taxonomyPatch(json("PATCH", {})), "ai.settings", "me-u", "chief-u"],
  ];
  for (const [name, invoke, permission, deniedRole, allowedRole] of matrix) {
    assert.equal((await call(null, invoke)).status, 401, `${name}: no session → 401`);
    const denied = await call(deniedRole, invoke);
    assert.equal(denied.status, 403, `${name}: ${deniedRole} → 403`);
    assert.equal((await denied.json()).permission, permission, `${name}: names the missing permission`);
    const allowed = await call(allowedRole, invoke);
    assert.ok(![401, 403].includes(allowed.status), `${name}: ${allowedRole} passes the gate (got ${allowed.status})`);
  }
  checks++;
  // لا مسار API لسجل التدقيق — الشاشة تُحرس في الخادم عبر requireScreen("audit.view") فقط.

  // Editor pinning persists, without granting breaking-news or immediate publishing.
  const draftInput = { title: 'دراسة جديدة توضح أثر النوم على صحة القلب', body: cleanBody, section: 'health', pinned: true, breakingUntil: future };
  const saved = await call('editor-u', () => subject.saveApi(json('POST', draftInput)));
  assert.equal(saved.status, 200);
  const editorDraft = await saved.json();
  const pinState = async id => (await admin.query('select pinned,breaking_until,status,scheduled_at from stories where id=$1', [id])).rows[0];
  assert.equal((await pinState(editorDraft.id)).pinned, 1);
  assert.equal((await pinState(editorDraft.id)).breaking_until, null);
  assert.equal((await call('editor-u', () => subject.publishApi(json('POST', { id: editorDraft.id, expectedVersion: editorDraft.version })))).status, 403);
  const scheduled = await call('editor-u', () => subject.scheduleApi(json('POST', { id: editorDraft.id, expectedVersion: editorDraft.version, scheduledAt: future })));
  assert.equal(scheduled.status, 200, await scheduled.clone().text());
  assert.equal((await pinState(editorDraft.id)).status, 'scheduled');
  assert.equal((await pinState(editorDraft.id)).scheduled_at, future);
  const scheduledVersion = (await scheduled.json()).version;
  const updated = await call('editor-u', () => subject.saveApi(json('POST', { ...draftInput, id: editorDraft.id, expectedVersion: scheduledVersion, pinned: false, updateScheduled: true })));
  assert.equal(updated.status, 200, await updated.clone().text());
  assert.equal((await pinState(editorDraft.id)).pinned, 0);
  assert.equal((await pinState(editorDraft.id)).scheduled_at, future);
  const deniedPin = await call('restricted-u', () => subject.saveApi(json('POST', draftInput)));
  assert.equal(deniedPin.status, 200);
  const restrictedDraft = await deniedPin.json();
  assert.equal((await pinState(restrictedDraft.id)).pinned, 0);
  assert.equal((await pinState(restrictedDraft.id)).breaking_until, null);
  assert.equal((await call('restricted-u', () => subject.scheduleApi(json('POST', { id: restrictedDraft.id, expectedVersion: restrictedDraft.version, scheduledAt: future })))).status, 403);
  assert.equal((await call('editor-u', () => subject.scheduleApi(json('POST', { id: 'blocked-story', expectedVersion: 1, scheduledAt: future })))).status, 422);
  assert.equal((await pinState('blocked-story')).status, 'review');
  checks++;

  // بوابة الحارس: مخالفة قاطعة تعيد 422 وتبقي الحالة كما هي بلا أثر نشر في سجل التدقيق.
  const blocked = await call("me-u", () => subject.publishApi(json("POST", { id: "blocked-story", expectedVersion: 1 })));
  assert.equal(blocked.status, 422);
  const blockedResult = await blocked.json();
  assert.ok(blockedResult.blocking.includes("RESTRICTED-ISRAEL"), "the deterministic dictionary rule is named");
  assert.equal((await admin.query("select status, version from stories where id='blocked-story'")).rows[0].status, "review");
  assert.equal(await count("action='status:published' and story_id='blocked-story'"), 0);
  const published = await call("me-u", () => subject.publishApi(json("POST", { id: "clean-story", expectedVersion: 1 })));
  assert.equal(published.status, 200, "a clean story publishes through the same gate");
  assert.equal((await admin.query("select status from stories where id='clean-story'")).rows[0].status, "published");
  assert.equal(await count("action='status:published' and story_id='clean-story'"), 1);
  checks++;

  // إلزام التحقق بخطوتين: مسؤول بلا MFA يُرفض في كل مسار محكوم حتى يفعّله من مسار الحساب المسموح.
  const gated = await call("nomfa-u", () => subject.membersGet());
  assert.equal(gated.status, 403);
  assert.equal((await gated.json()).mfaRequired, true, "the refusal tells the client why");
  assert.equal((await call("nomfa-u", () => subject.aiSettingsGet())).status, 403, "requireActor gates too");
  assert.equal((await call("nomfa-u", () => subject.publishApi(json("POST", { id: "missing" })))).status, 403);
  assert.equal((await call("nomfa-u", () => subject.loadActor())).mfaRequired, true);
  assert.equal((await call("chief-u", () => subject.loadActor())).mfaRequired, false, "non-admin roles are not forced");
  const begin = await call("nomfa-u", () => subject.mfaApi(json("POST", { action: "begin", password: "matrix-password-123" })));
  assert.equal(begin.status, 200, "the setup route stays open");
  const enrollment = await begin.json();
  const code = await totp(enrollment.secret, Math.floor(Date.now() / 30000));
  const enabled = await call("nomfa-u", () => subject.mfaApi(json("POST", { action: "enable", password: "matrix-password-123", code, enrollment: enrollment.enrollment })));
  assert.equal(enabled.status, 200);
  const enabledSession = await readSessionToken(enabled.headers.get("Set-Cookie").split(";")[0].slice(SESSION_COOKIE.length + 1));
  globalThis.__matrixSession = enabledSession;
  assert.equal((await withDb(() => subject.membersGet())).status, 200, "after enabling MFA the same account passes");
  assert.equal((await withDb(() => subject.loadActor())).mfaRequired, false);
  delete process.env.TAHRIR_MFA_KEY;
  assert.equal((await call("admin-u", () => subject.loadActor())).mfaRequired, false, "without an MFA key nobody can enrol, so nobody is locked out");
  process.env.TAHRIR_MFA_KEY = "cd".repeat(32);
  delete process.env.TAHRIR_MFA_ENFORCE;
  assert.equal((await call("admin-u", () => subject.loadActor())).mfaRequired, false, "enforcement is opt-in: without TAHRIR_MFA_ENFORCE=1 nobody is forced");
  delete process.env.TAHRIR_MFA_KEY;
  process.env.TAHRIR_MFA_ENFORCE = "1";
  await admin.query("update users set mfa_secret=null where id='admin2-u'");
  assert.equal((await call("admin2-u", () => subject.membersGet())).status, 200);
  await admin.query("update users set mfa_secret='enforced' where id='admin2-u'");
  process.env.TAHRIR_MFA_KEY = "cd".repeat(32);
  checks++;

  // الخروج يبطل الرمز: الرمز الصادر قبل الخروج يعود 401 بعده.
  const login = await withDb(() => subject.loginApi(new Request("https://test.invalid/api/tahrir/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "chief-u", password: "matrix-password-123" }) })));
  assert.equal(login.status, 200);
  const preLogout = await readSessionToken(login.headers.get("Set-Cookie").split(";")[0].slice(SESSION_COOKIE.length + 1));
  globalThis.__matrixSession = preLogout;
  assert.equal((await withDb(() => subject.membersGet())).status, 200);
  const logout = await withDb(() => subject.logoutApi());
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("Set-Cookie"), /Max-Age=0/);
  assert.equal((await withDb(() => subject.membersGet())).status, 401, "the pre-logout token is dead");
  assert.equal(await withDb(() => subject.loadActor()), null);
  assert.equal(await count("action='logout' and actor='chief-u'"), 1);
  assert.equal((await withDb(() => subject.logoutApi())).status, 200, "a dead session still clears the cookie");
  assert.equal(await count("action='logout' and actor='chief-u'"), 1, "a dead session does not revoke again");
  checks++;

  // التسلسل الإداري — عضو عمليات يحمل users.manage/users.suspend/roles.manage بلا الشاملة.
  const refusals = [];
  const expectRefusal = async (name, invoke) => {
    const response = await call("ops-u", invoke);
    assert.equal(response.status, 403, `${name} → 403`);
    refusals.push([name, (await response.json()).error]);
  };
  const SELF = "لا يمكنك تعديل حسابك من شاشة الأعضاء.";
  const ADMIN_ONLY = "التصرف في حسابات مسؤولي النظام لمسؤول النظام وحده.";
  const SENSITIVE = "منح صلاحيات الإدارة لمسؤول النظام وحده.";
  // (أ) لا تعديل للحساب نفسه.
  await expectRefusal("own role", () => subject.memberPatch(json("PATCH", { role: "editor" }), ctx("ops-u")));
  await expectRefusal("own status", () => subject.memberStatus(json("POST", { status: "suspended", reason: "تجربة" }), ctx("ops-u")));
  await expectRefusal("own password", () => subject.memberPassword(json("POST", { password: "temporary-pass-123" }), ctx("ops-u")));
  await expectRefusal("own overrides", () => subject.memberOverrides(json("PUT", { overrides: [] }), ctx("ops-u")));
  assert.equal((await call("ops-u", () => subject.memberPatch(json("PATCH", { displayName: "اسم عمليات" }), ctx("ops-u")))).status, 200, "own display name is not a privilege change");
  // (ب) حسابات مسؤولي النظام لحامل الشاملة وحده.
  await expectRefusal("create admin", () => subject.membersPost(json("POST", { username: "new.admin", displayName: "مسؤول", role: "admin", password: "temporary-pass-123" })));
  await expectRefusal("demote admin", () => subject.memberPatch(json("PATCH", { role: "editor" }), ctx("admin2-u")));
  await expectRefusal("promote to admin", () => subject.memberPatch(json("PATCH", { role: "admin" }), ctx("editor-u")));
  await expectRefusal("reset admin password", () => subject.memberPassword(json("POST", { password: "temporary-pass-123" }), ctx("admin2-u")));
  await expectRefusal("suspend admin", () => subject.memberStatus(json("POST", { status: "suspended", reason: "تجربة" }), ctx("admin2-u")));
  await expectRefusal("admin overrides", () => subject.memberOverrides(json("PUT", { overrides: [] }), ctx("admin2-u")));
  // (ج) لا منح لصلاحيات الإدارة بلا الشاملة — دورًا أو استثناءً أو نسخًا.
  await expectRefusal("grant users.manage to role", () => subject.rolePermission(json("PATCH", { permissionKey: "users.manage", granted: true }), ctx("editor")));
  await expectRefusal("grant roles.manage override", () => subject.memberOverrides(json("PUT", { overrides: [{ permissionKey: "roles.manage", effect: "allow" }] }), ctx("editor-u")));
  assert.equal((await call("admin-u", () => subject.rolesPost(json("POST", { id: "ops_role", label: "دور عمليات" })))).status, 200);
  assert.equal((await call("admin-u", () => subject.rolePermission(json("PATCH", { permissionKey: "users.suspend", granted: true }), ctx("ops_role")))).status, 200, "the wildcard holder grants sensitive keys");
  await expectRefusal("copy role with sensitive keys", () => subject.rolesPost(json("POST", { id: "ops_copy", label: "نسخة", copyFrom: "ops_role" })));
  assert.equal((await admin.query("select count(*)::int n from roles where id='ops_copy'")).rows[0].n, 0, "a refused copy inserts nothing");
  assert.deepEqual(refusals.map(([, message]) => message), [SELF, SELF, SELF, SELF, ADMIN_ONLY, ADMIN_ONLY, ADMIN_ONLY, ADMIN_ONLY, ADMIN_ONLY, ADMIN_ONLY, SENSITIVE, SENSITIVE, SENSITIVE]);
  assert.equal(await count("action in ('users:denied','roles:denied') and actor='ops-u'"), refusals.length, "every refusal is audited with its reason");
  assert.equal(await count("action='users:update' and detail like '%الدور%'"), 0, "no refused role change was written");
  assert.equal((await admin.query("select role, status from users where id in ('admin2-u','editor-u','ops-u') order by id")).rows.map((row) => `${row.role}:${row.status}`).join(","), "admin:active,editor:active,managing_editor:active");
  // ما دون الحساس يبقى متاحًا لحامل roles.manage.
  assert.equal((await call("ops-u", () => subject.rolePermission(json("PATCH", { permissionKey: "story.publish", granted: true }), ctx("editor")))).status, 200);
  assert.equal((await call("ops-u", () => subject.rolePermission(json("PATCH", { permissionKey: "story.publish", granted: false }), ctx("editor")))).status, 200);
  assert.equal((await call("ops-u", () => subject.memberOverrides(json("PUT", { overrides: [{ permissionKey: "story.publish", effect: "allow" }, { permissionKey: "users.manage", effect: "deny" }] }), ctx("editor-u")))).status, 200, "denying a sensitive key is de-escalation, not a grant");
  assert.equal((await call("ops-u", () => subject.memberOverrides(json("PUT", { overrides: [] }), ctx("editor-u")))).status, 200);
  assert.equal((await admin.query("select count(*)::int n from user_permissions where user_id='editor-u'")).rows[0].n, 0, "replacing the list is atomic and complete");
  // المسار السعيد لحامل الشاملة.
  const created = await call("admin-u", () => subject.membersPost(json("POST", { username: "new.admin", displayName: "مسؤول جديد", role: "admin", password: "temporary-pass-123" })));
  assert.equal(created.status, 200);
  const newAdminId = (await created.json()).id;
  assert.equal((await call("admin-u", () => subject.memberPatch(json("PATCH", { role: "editor" }), ctx(newAdminId)))).status, 200);
  assert.equal((await call("admin-u", () => subject.memberPatch(json("PATCH", { role: "admin" }), ctx(newAdminId)))).status, 200);
  assert.equal((await call("admin-u", () => subject.memberPassword(json("POST", { password: "temporary-pass-456" }), ctx(newAdminId)))).status, 200);
  assert.equal((await call("admin-u", () => subject.memberOverrides(json("PUT", { overrides: [{ permissionKey: "roles.manage", effect: "allow" }] }), ctx(newAdminId)))).status, 200);
  assert.equal((await call("admin-u", () => subject.memberStatus(json("POST", { status: "suspended", reason: "انتهى التكليف" }), ctx(newAdminId)))).status, 200);
  assert.equal((await admin.query("select status from users where id=$1", [newAdminId])).rows[0].status, "suspended");
  // الحارس الذاتي يسري على حامل الشاملة أيضًا؛ كلمة مروره تُغيَّر من «أمان الحساب» وحدها.
  assert.equal((await call("admin-u", () => subject.memberPassword(json("POST", { password: "temporary-pass-123" }), ctx("admin-u")))).status, 403);
  assert.equal((await call("admin-u", () => subject.memberPatch(json("PATCH", { role: "editor" }), ctx("admin-u")))).status, 403);
  assert.equal(await count("action='users:denied' and actor='admin-u'"), 2);
  checks++;
  console.log(`Permission matrix integration: ${checks} checks passed (${matrix.length} gated routes × 3 sessions, guard 422, MFA enforcement, logout revocation, admin hierarchy with ${refusals.length} audited refusals).`);
} finally {
  await admin.end();
  await rm(directory, { recursive: true, force: true });
  delete globalThis.__matrixDb;
  delete globalThis.__matrixSession;
}
