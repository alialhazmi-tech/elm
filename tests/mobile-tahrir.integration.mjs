/**
 * واجهات القراءة للتطبيق (لوحة التحرير + حساب العضو) على قاعدة معزولة — نمط tests/workflow.integration.mjs:
 * حزمة esbuild بمزوّد قاعدة وجلسة مزيّفين، ترحيل ثم تفريغ، ثم استدعاء معالجات المسارات مباشرة.
 */
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
const directory = `tmp/mobile-tahrir-test-${process.pid}`;
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
const ORIGIN = "https://app.test.invalid";
const request = (path, init) => new Request(`${ORIGIN}${path}`, { headers: { host: "app.test.invalid", "x-forwarded-proto": "https", "content-type": "application/json" }, ...init });
const params = (value) => ({ params: Promise.resolve(value) });
const as = (userId) => { globalThis.__alelmSession = userId ? { userId, sessionVersion: 1 } : null; };
async function json(response, status = 200) {
  assert.equal(response.status, status, `expected ${status}, got ${response.status}: ${await response.clone().text()}`);
  if (status < 400) assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  return response.json();
}
try {
  await migrate(drizzle(admin), { migrationsFolder: "drizzle" });
  await admin.query("truncate user_permissions, role_permissions, roles, stories, story_slides, jak_sources, story_versions, audit_log, request_limits, ai_usage, ai_settings, users, media, series_proposals, member_saved_stories, member_likes, newsletter_subscribers, member_profiles, interests, member_interests, member_topic_scores, member_story_stats, member_events cascade");
  await build({
    stdin: { contents: `
      export { GET as meApi } from './app/api/tahrir/me/route';
      export { GET as overviewApi } from './app/api/tahrir/overview/route';
      export { GET as storyListApi } from './app/api/tahrir/story/route';
      export { GET as storyDetailApi } from './app/api/tahrir/story/[id]/route';
      export { GET as tasksApi } from './app/api/tahrir/tasks/route';
      export { GET as taxonomyApi } from './app/api/tahrir/taxonomy/route';
      export { GET as mediaApi } from './app/api/tahrir/media/route';
      export { GET as auditApi } from './app/api/tahrir/audit/route';
      export { GET as statsApi } from './app/api/tahrir/stats/route';
      export { GET as scheduleApi } from './app/api/tahrir/schedule/route';
      export { GET as seriesApi } from './app/api/tahrir/series/route';
      export { GET as historyApi } from './app/api/tahrir/story/history/route';
      export { GET as accountApi } from './app/api/me/account/route';
      export { POST as newsletterApi } from './app/api/me/newsletter/route';
      export { invalidateRoleCache } from './lib/tahrir/access';
      export { invalidateAiSettingsCache } from './lib/ai/settings';
      export { invalidateStatusCounts } from './lib/tahrir/status-counts';
    `, resolveDir: process.cwd(), loader: "ts" },
    outfile: `${directory}/subject.mjs`, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-db", setup(builder) {
      builder.onResolve({ filter: /^next\/cache$/ }, () => ({ path: "cache", namespace: "test" }));
      builder.onResolve({ filter: /^next\/server$/ }, () => ({ path: "next/server.js", external: true }));
      builder.onResolve({ filter: /^@\/lib\/tahrir\/auth$/ }, () => ({ path: `${process.cwd()}/lib/tahrir/crypto.ts` }));
      builder.onResolve({ filter: /^(?:@\/lib\/db|\.\.\/db\.ts)$/ }, () => ({ path: "db", namespace: "test" }));
      builder.onResolve({ filter: /^@\/lib\/membership\/auth$/ }, () => ({ path: "member-auth", namespace: "test" }));
      builder.onResolve({ filter: /^\.\/auth$/ }, args => args.importer.endsWith('/access.ts') ? ({ path: "auth", namespace: "test" }) : undefined);
      builder.onLoad({ filter: /.*/, namespace: "test" }, args => ({ contents: ({
        cache: "export const unstable_cache = load => load; export function revalidateTag(){} export function revalidatePath(){}",
        db: "export function getDb(){return globalThis.__alelmDb.getStore()}",
        auth: "export async function getSession(){return globalThis.__alelmSession ?? null}",
        "member-auth": "export const memberAuthConfigured=true; export const memberAuth={getSession:async()=>({data:globalThis.__memberUser?{user:globalThis.__memberUser}:null})};",
      })[args.path], loader: "js" }));
    } }],
  });
  const subject = await import(`../${directory}/subject.mjs`);
  const now = new Date().toISOString();
  const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

  // الأدوار والأعضاء: مسؤول شامل، مدير تحرير (تحرير أي مادة + جدولة)، محرران، وقارئ بلا صلاحيات محتوى.
  await admin.query("insert into roles(id,label,description,created_at,updated_at) values ('admin','مسؤول','',$1,$1),('managing_editor','مدير التحرير','',$1,$1),('editor','محرر','',$1,$1),('viewer','مشاهد','',$1,$1)", [now]);
  const grants = { admin: ["*"], managing_editor: ["story.create", "story.edit.own", "story.edit.any", "story.submit", "story.approve", "story.publish", "story.schedule", "story.archive", "story.restore", "media.upload", "media.rights", "stats.view", "audit.view"], editor: ["story.create", "story.edit.own", "story.submit", "media.upload", "stats.view"], viewer: [] };
  for (const [role, keys] of Object.entries(grants)) for (const key of keys) await admin.query("insert into role_permissions(role_id,permission_key) values($1,$2)", [role, key]);
  for (const [id, role] of [["admin-1", "admin"], ["manager-1", "managing_editor"], ["editor-1", "editor"], ["editor-2", "editor"], ["viewer-1", "viewer"]]) {
    await admin.query("insert into users(id,username,display_name,password_hash,role,created_at) values($1,$1,$2,'not-a-login',$3,$4)", [id, `الاسم ${id}`, role, now]);
  }
  subject.invalidateRoleCache();

  // المواد: مسودتان لمحررين مختلفين، مراجعة، منشورة اليوم، مجدولة غدًا وأمس-غير-مرقّاة، مؤرشفة بسبب.
  const insertStory = (row) => admin.query(
    "insert into stories(id,slug,section,title,excerpt,body,status,author_id,author_name,assigned_to,due_at,returned_at,revision_of,series_slug,format,published_at,scheduled_at,updated_at,version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)",
    [row.id, row.slug ?? row.id, row.section ?? "news", row.title, row.excerpt ?? "", row.body ?? "<p>متن</p>", row.status, row.authorId ?? null, row.authorName ?? "", row.assignedTo ?? null, row.dueAt ?? null, row.returnedAt ?? null, row.revisionOf ?? null, row.seriesSlug ?? null, row.format ?? "news", row.publishedAt ?? null, row.scheduledAt ?? null, row.updatedAt ?? now, row.version ?? 1],
  );
  await insertStory({ id: "draft-own", title: "مسودة المحرر الأول", status: "draft", authorId: "editor-1", authorName: "الاسم editor-1", seriesSlug: "absat" });
  await insertStory({ id: "draft-other", title: "مسودة المحرر الثاني", status: "draft", authorId: "editor-2", authorName: "الاسم editor-2" });
  await insertStory({ id: "draft-assigned", title: "مسودة مسندة", status: "draft", authorId: "editor-2", assignedTo: "editor-1", dueAt: iso(-3_600_000), returnedAt: now });
  await insertStory({ id: "in-review", title: "مادة بانتظار الاعتماد", status: "review", authorId: "editor-1", body: "<p>متن للمراجعة</p>" });
  await insertStory({ id: "published-1", title: "مادة منشورة عن الرياض", status: "published", authorId: "editor-2", authorName: "الاسم editor-2", publishedAt: now, section: "economy", version: 3 });
  await insertStory({ id: "scheduled-1", title: "مجدولة غدًا", status: "scheduled", authorId: "editor-2", scheduledAt: iso(86_400_000) });
  await insertStory({ id: "scheduled-0", title: "مجدولة بعد ساعة", status: "scheduled", authorId: "editor-2", scheduledAt: iso(3_600_000) });
  await insertStory({ id: "archived-1", title: "مادة مؤرشفة", status: "archived", authorId: "editor-2", format: "jakalelm" });
  await admin.query("insert into audit_log(id,at,actor,action,story_id,detail) values('audit-archive',$1,'manager-1','story:archive','archived-1','سبب الأرشفة الكافي'),('audit-publish',$1,'manager-1','status:published','published-1','')", [now]);
  await admin.query("insert into story_versions(id,story_id,version,data,actor,created_at) values('version-1','published-1',2,$1,'manager-1',$2)", [JSON.stringify({ story: { title: "عنوان النسخة السابقة" }, slides: [], source: null }), now]);
  for (let index = 0; index < 30; index += 1) {
    await admin.query("insert into media(id,url,filename,mime,bytes,width,height,rights_cleared,flags,uploaded_by,created_at,ai_generated) values($1,$2,$3,'image/jpeg',1000,800,600,$4,'',$5,$6,$7)",
      [`media-${String(index).padStart(2, "0")}`, `/uploads/media-${index}.jpg`, index < 5 ? `صورة الرياض ${index}` : `صورة ${index}`, index % 3 === 0 ? 1 : 0, "الاسم editor-1", new Date(Date.parse(now) - index * 1000).toISOString(), index === 1 ? 1 : 0]);
  }
  await admin.query("insert into series_proposals(id,name,value_case,gap_case,impact_case,proposed_by,status,created_at) values('proposal-1','سلسلة مقترحة','قيمة','فجوة','أثر','editor-1','pending',$1)", [now]);
  subject.invalidateStatusCounts();

  // 8. الهوية — مفتوحة للجلسة الحية وتعيد الصلاحيات كمصفوفة.
  as(null);
  await json(await withDb(() => subject.meApi()), 401);
  as("editor-1");
  const me = await json(await withDb(() => subject.meApi()));
  assert.equal(me.actor.userId, "editor-1");
  assert.equal(me.actor.roleLabel, "محرر");
  assert.deepEqual(me.actor.permissions, ["media.upload", "stats.view", "story.create", "story.edit.own", "story.submit"]);
  assert.equal(me.actor.mustChangePassword, false);
  assert.equal(typeof me.governance.editorialGuard, "boolean");
  await admin.query("update users set must_change_password=1 where id='viewer-1'");
  as("viewer-1");
  assert.equal((await json(await withDb(() => subject.meApi()))).actor.mustChangePassword, true, "كلمة المرور المؤقتة لا تحجب /me");
  await json(await withDb(() => subject.overviewApi()), 403);
  await admin.query("update users set must_change_password=0 where id='viewer-1'");
  checks++;

  // 9. نظرة اليوم — الحارس يُحسب على طابور الاعتماد فقط، وcanEdit بحسب الفاعل.
  as("admin-1");
  const overview = await json(await withDb(() => subject.overviewApi()));
  assert.equal(overview.counts.draft, 3); assert.equal(overview.counts.published, 1);
  assert.equal(overview.todayCount, 1);
  assert.equal(overview.perDay.length, 14);
  assert.equal(overview.review.length, 1); assert.deepEqual(Object.keys(overview.review[0].guard).sort(), ["label", "tone"]);
  assert.equal(overview.review[0].canEdit, true);
  assert.equal(overview.latestPublished[0].guard, null);
  assert.equal(overview.latestPublished[0].publicHref, "/economy/published-1/published-1");
  assert.equal(overview.latestDraft.length, 3);
  assert.deepEqual(overview.scheduled.map((row) => row.id).sort(), ["scheduled-0", "scheduled-1"]);
  assert.deepEqual(overview.media, { all: 30, ok: 10, pending: 20 });
  assert.ok(overview.nextScheduledAt && overview.today.dayKey.length === 10);
  as("editor-1");
  const editorOverview = await json(await withDb(() => subject.overviewApi()));
  assert.equal(editorOverview.review[0].canEdit, true, "صاحب المادة يحررها");
  assert.equal(editorOverview.latestPublished[0].canEdit, false, "مادة الآخرين بلا edit.any");
  checks++;

  // 10. قائمة المواد — الفلاتر والعدّادات وقصّ الصفحة والأرشيف بسببه.
  as("admin-1");
  const all = await json(await withDb(() => subject.storyListApi(request("/api/tahrir/story"))));
  assert.equal(all.total, 7); assert.equal(all.rows.length, 7); assert.equal(all.perPage, 30);
  assert.equal(all.counts.active, 7); assert.equal(all.counts.archived, 1);
  assert.deepEqual(all.filters, { status: null, q: "", series: null });
  assert.ok(all.rows.every((row) => row.status !== "archived" && row.guard && typeof row.canEdit === "boolean"));
  const drafts = await json(await withDb(() => subject.storyListApi(request("/api/tahrir/story?status=draft&p=999"))));
  assert.equal(drafts.total, 3); assert.equal(drafts.page, 1, "رقم صفحة خارج المدى يُقصّ إلى الأخيرة");
  assert.ok(drafts.rows.every((row) => row.status === "draft" && row.statusLabel === "مسودة"));
  const searched = await json(await withDb(() => subject.storyListApi(request("/api/tahrir/story?q=%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6"))));
  assert.deepEqual(searched.rows.map((row) => row.id), ["published-1"]); assert.equal(searched.total, 1); assert.equal(searched.filters.q, "الرياض");
  const bySeries = await json(await withDb(() => subject.storyListApi(request("/api/tahrir/story?series=absat"))));
  assert.deepEqual(bySeries.rows.map((row) => row.id), ["draft-own"]); assert.deepEqual(bySeries.rows[0].series, { name: "أبسط", color: "#2d9a8c" });
  assert.equal((await json(await withDb(() => subject.storyListApi(request("/api/tahrir/story?series=unknown&status=bogus"))))).total, 7);
  const archived = await json(await withDb(() => subject.storyListApi(request("/api/tahrir/story?status=archived"))));
  assert.equal(archived.rows[0].isJak, true);
  assert.deepEqual(archived.rows[0].archive, { at: now, actor: "manager-1", reason: "سبب الأرشفة الكافي" });
  assert.equal(all.rows[0].archive, null);
  checks++;

  // 11. مادة واحدة — صاحبها والمسند إليه والمالك لصلاحية edit.any؛ 403 لغيرهم و404 للمفقودة.
  as("editor-1");
  const own = await json(await withDb(() => subject.storyDetailApi(request("/x"), params({ id: "draft-own" }))));
  assert.equal(own.story.id, "draft-own"); assert.equal(own.story.version, 1); assert.equal(own.story.pinned, false);
  assert.deepEqual(own.story.keywords, []); assert.equal(own.story.seoTitle, "");
  assert.deepEqual(own.capabilities, { canEdit: true, canSubmit: true, canApprove: false, canSchedule: false, canArchive: false, canRestore: false, canDelete: true, canAssign: false });
  assert.equal(own.historyHref, "/tahrir/history/draft-own"); assert.equal(own.archiveEvent, null);
  assert.equal((await json(await withDb(() => subject.storyDetailApi(request("/x"), params({ id: "draft-assigned" }))))).story.assignedTo, "editor-1");
  await json(await withDb(() => subject.storyDetailApi(request("/x"), params({ id: "draft-other" }))), 403);
  await json(await withDb(() => subject.storyDetailApi(request("/x"), params({ id: "missing" }))), 404);
  as("admin-1");
  const adminView = await json(await withDb(() => subject.storyDetailApi(request("/x"), params({ id: "draft-other" }))));
  assert.equal(adminView.capabilities.canApprove, true); assert.equal(adminView.capabilities.canAssign, true);
  const archivedView = await json(await withDb(() => subject.storyDetailApi(request("/x"), params({ id: "archived-1" }))));
  assert.equal(archivedView.archiveEvent.reason, "سبب الأرشفة الكافي"); assert.equal(archivedView.capabilities.canDelete, false);
  as("viewer-1");
  await json(await withDb(() => subject.storyDetailApi(request("/x"), params({ id: "draft-own" }))), 403);
  checks++;

  // 12. مهامي — موادّي والمسند إليّ بالمرشّحات الأربعة.
  as("editor-1");
  const tasks = await json(await withDb(() => subject.tasksApi(request("/api/tahrir/tasks"))));
  assert.deepEqual(tasks.rows.map((row) => row.id), ["draft-assigned", "draft-own", "in-review"]);
  assert.equal(tasks.rows[0].overdue, true); assert.equal(tasks.rows[0].canEdit, true); assert.equal(tasks.rows[0].statusLabel, "مسودة");
  assert.equal(tasks.hasMore, false); assert.equal(tasks.filter, "all");
  assert.deepEqual((await json(await withDb(() => subject.tasksApi(request("/api/tahrir/tasks?filter=assigned"))))).rows.map((row) => row.id), ["draft-assigned"]);
  assert.deepEqual((await json(await withDb(() => subject.tasksApi(request("/api/tahrir/tasks?filter=returned"))))).rows.map((row) => row.id), ["draft-assigned"]);
  assert.deepEqual((await json(await withDb(() => subject.tasksApi(request("/api/tahrir/tasks?filter=own"))))).rows.map((row) => row.id), ["draft-own", "in-review"]);
  assert.deepEqual((await json(await withDb(() => subject.tasksApi(request("/api/tahrir/tasks?filter=own&page=2"))))).rows, []);
  checks++;

  // 13. التصنيفات — خريطة الظهور لمن يملك ai.settings فقط.
  const taxonomy = await json(await withDb(() => subject.taxonomyApi()));
  assert.ok(taxonomy.sections.some((item) => item.slug === "news" && item.shortName === "أخبار"));
  assert.ok(taxonomy.series.some((item) => item.slug === "absat" && item.archived === false));
  assert.deepEqual(taxonomy.formats.map((item) => item.id), ["news", "infographics", "videos", "reports", "podcasts", "jakalelm"]);
  assert.equal(taxonomy.visibility, null);
  as("admin-1");
  assert.deepEqual((await json(await withDb(() => subject.taxonomyApi()))).visibility, {});
  checks++;

  // 14. الوسائط — 24 لكل صفحة، روابط مطلقة من أصل الطلب، المرشّحات والبحث والبوابة.
  as("editor-1");
  const media1 = await json(await withDb(() => subject.mediaApi(request("/api/tahrir/media"))));
  assert.equal(media1.items.length, 24); assert.equal(media1.total, 30); assert.equal(media1.page, 1); assert.equal(media1.perPage, 24);
  assert.deepEqual(media1.counts, { all: 30, ok: 10, pending: 20 });
  assert.equal(media1.items[0].url, `${ORIGIN}/uploads/media-0.jpg`); assert.equal(media1.items[0].rightsCleared, true);
  assert.equal(media1.items[1].aiGenerated, true); assert.equal(media1.items[1].rightsCleared, false);
  const media2 = await json(await withDb(() => subject.mediaApi(request("/api/tahrir/media?p=2"))));
  assert.equal(media2.items.length, 6); assert.equal(media2.page, 2);
  const pending = await json(await withDb(() => subject.mediaApi(request("/api/tahrir/media?f=pending"))));
  assert.equal(pending.total, 20); assert.ok(pending.items.every((item) => !item.rightsCleared)); assert.equal(pending.filter, "pending");
  const found = await json(await withDb(() => subject.mediaApi(request("/api/tahrir/media?q=%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6"))));
  assert.equal(found.total, 5); assert.equal(found.counts.all, 5); assert.equal(found.q, "الرياض");
  as("viewer-1");
  await json(await withDb(() => subject.mediaApi(request("/api/tahrir/media"))), 403);
  checks++;

  // 15–16. التدقيق والإحصاءات ببوابتيهما.
  as("editor-1");
  await json(await withDb(() => subject.auditApi(request("/api/tahrir/audit"))), 403);
  const stats = await json(await withDb(() => subject.statsApi()));
  assert.equal(stats.counts.published, 1); assert.equal(stats.perDay.length, 14);
  assert.deepEqual(stats.formatDistribution, [{ format: "news", count: 1, label: "أخبار" }]);
  assert.deepEqual(stats.topAuthors, [{ authorName: "الاسم editor-2", count: 1 }]);
  assert.deepEqual(Object.keys(stats.readingTime), ["quick", "medium", "long"]);
  as("viewer-1");
  await json(await withDb(() => subject.statsApi()), 403);
  as("admin-1");
  const audit = await json(await withDb(() => subject.auditApi(request("/api/tahrir/audit?limit=1"))));
  assert.equal(audit.rows.length, 1); assert.equal(audit.rows[0].actorName, "الاسم manager-1"); assert.equal(typeof audit.loadedAt, "number");
  assert.equal((await json(await withDb(() => subject.auditApi(request("/api/tahrir/audit"))))).rows.length, 2);
  checks++;

  // 17. الجدولة — 403 للمحرر؛ للمعتمد قائمة مرتبة بالموعد.
  as("editor-1");
  await json(await withDb(() => subject.scheduleApi()), 403);
  as("manager-1");
  const schedule = await json(await withDb(() => subject.scheduleApi()));
  assert.deepEqual(schedule.scheduled.map((row) => row.id), ["scheduled-0", "scheduled-1"]);
  assert.equal(schedule.nextScheduledAt, schedule.scheduled[0].scheduledAt); assert.equal(typeof schedule.automatic, "boolean");
  checks++;

  // 18. السلاسل — التوزيع والمقترحات وصفوف الظهور.
  as("editor-1");
  const series = await json(await withDb(() => subject.seriesApi()));
  assert.deepEqual(series.distribution, []); assert.equal(series.proposals[0].name, "سلسلة مقترحة"); assert.ok(Array.isArray(series.rows));
  checks++;

  // 19. سجل النسخ — بصلاحية تحرير المادة.
  as("editor-1");
  await json(await withDb(() => subject.historyApi(request("/api/tahrir/story/history?id=published-1"))), 403);
  await json(await withDb(() => subject.historyApi(request("/api/tahrir/story/history"))), 400);
  as("manager-1");
  const history = await json(await withDb(() => subject.historyApi(request("/api/tahrir/story/history?id=published-1"))));
  assert.deepEqual(history.versions, [{ id: "version-1", version: 2, actor: "manager-1", createdAt: now, title: "عنوان النسخة السابقة" }]);
  assert.deepEqual(history.story, { id: "published-1", status: "published", version: 3, revisionOf: null, format: "news" });
  assert.equal(history.canRestore, true);
  await json(await withDb(() => subject.historyApi(request("/api/tahrir/story/history?id=missing"))), 404);
  checks++;

  // 6–7. حساب العضو والنشرة: جلسة العضوية (لا جلسة اللوحة).
  globalThis.__memberUser = null;
  await json(await withDb(() => subject.accountApi(request("/api/me/account"))), 401);
  await json(await withDb(() => subject.newsletterApi(request("/api/me/newsletter", { method: "POST", body: JSON.stringify({ subscribed: true }) }))), 401);
  globalThis.__memberUser = { id: "member-1", name: "عضو", email: "Member@Example.test", emailVerified: false, createdAt: "2026-01-01T00:00:00.000Z" };
  await admin.query("insert into member_saved_stories(member_id,story_id,created_at) values('member-1','published-1',$1),('member-1','draft-own',$1)", [now]);
  const account = await json(await withDb(() => subject.accountApi(request("/api/me/account?tab=saved"))));
  assert.equal(account.memberId, "member-1"); assert.equal(account.tab, "saved");
  assert.deepEqual(account.user, { name: "عضو", email: "Member@Example.test", joinedAt: "2026-01-01T00:00:00.000Z", emailVerified: false, image: null });
  assert.equal(account.stats.savedCount, 1, "المسودات لا تُعدّ ضمن المحفوظات");
  assert.equal(account.items.length, 1); assert.equal(account.items[0].story.id, "published-1"); assert.equal(account.items[0].savedAt, now);
  assert.ok(account.items[0].story.href.startsWith("/economy/published-1/")); assert.equal("body" in account.items[0].story, false);
  assert.equal(account.newsletterSubscribed, false); assert.equal(account.personalizationEnabled, true);
  assert.equal(account.page, 1); assert.equal(account.pageCount, 1);
  assert.deepEqual((await json(await withDb(() => subject.accountApi(request("/api/me/account?tab=liked"))))).items, []);
  assert.equal((await json(await withDb(() => subject.accountApi(request("/api/me/account?tab=history&page=5"))))).page, 1);
  const newsletter = (body) => subject.newsletterApi(request("/api/me/newsletter", { method: "POST", body: JSON.stringify(body) }));
  await json(await withDb(() => newsletter({ subscribed: "yes" })), 400);
  await json(await withDb(() => newsletter({ subscribed: true })), 403, "الاشتراك يشترط بريدًا موثّقًا");
  globalThis.__memberUser.emailVerified = true;
  assert.deepEqual(await json(await withDb(() => newsletter({ subscribed: true }))), { ok: true, subscribed: true });
  await json(await withDb(() => newsletter({ subscribed: true })));
  assert.deepEqual((await admin.query("select email, source from newsletter_subscribers")).rows, [{ email: "member@example.test", source: "account" }]);
  assert.equal((await json(await withDb(() => subject.accountApi(request("/api/me/account"))))).newsletterSubscribed, true);
  assert.deepEqual(await json(await withDb(() => newsletter({ subscribed: false }))), { ok: true, subscribed: false });
  assert.equal((await admin.query("select count(*)::int as n from newsletter_subscribers")).rows[0].n, 0);
  checks++;

  console.log(`PostgreSQL mobile/tahrir read API integration: ${checks} checks passed.`);
} finally {
  await admin.end();
  await rm(directory, { recursive: true, force: true });
}
