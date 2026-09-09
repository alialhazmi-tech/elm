import assert from 'node:assert/strict';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { RETENTION, RETENTION_BATCH, retentionCutoffs, runRetentionCleanup } from '../lib/tahrir/retention.ts';

const source = process.env.TEST_DATABASE_URL;
if (!source || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error('Isolated TEST_DATABASE_URL named alelm_test* required');
const database = `alelm_test_retention_${process.pid}`;
const url = new URL(source); url.pathname = `/${database}`;
const admin = new pg.Client({ connectionString: source }); await admin.connect();
let client;
try {
  await admin.query(`create database "${database}"`);
  client = new pg.Client({ connectionString: url.href }); await client.connect();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: 'drizzle' });

  const now = new Date('2026-09-09T12:00:00.000Z');
  const cutoff = retentionCutoffs(now);
  const daysAgo = days => new Date(now.getTime() - days * 86_400_000).toISOString();
  assert.equal(cutoff.autosaveAudit, daysAgo(90));
  assert.equal(cutoff.aiUsage, '2025-08-09T12:00:00.000Z');

  await client.query("insert into users(id,username,display_name,password_hash,created_at) values('u1','u1','محرر','x',$1)", [now.toISOString()]);
  await client.query("insert into stories(id,slug,section,title,status) values('s1','s1','health','مادة','published'),('s2','s2','health','مادة ثانية','published')");

  // audit_log: الحفظ التلقائي القديم فقط يُحذف؛ اليدوي القديم والتلقائي الحديث وبقية الأفعال تبقى.
  const audit = [
    ['auto-old', 'draft:save', daysAgo(91), { saveMode: 'automatic' }],
    ['auto-edge', 'draft:save', daysAgo(89), { saveMode: 'automatic' }],
    ['manual-old', 'draft:save', daysAgo(400), { saveMode: 'manual' }],
    ['no-context-old', 'draft:save', daysAgo(400), null],
    ['publish-old', 'status:published', daysAgo(400), { saveMode: 'automatic' }],
  ];
  for (const [id, action, at, context] of audit) await client.query('insert into audit_log(id,at,actor,action,story_id,detail,context) values($1,$2,$3,$4,$5,$6,$7)', [id, at, 'u1', action, 's1', '', context]);
  // دفعة أكبر من حد الدفعة لإثبات التكرار حتى النفاد.
  await client.query(`insert into audit_log(id,at,actor,action,story_id,detail,context)
    select 'bulk-'||n, $1, 'u1', 'draft:save', 's1', '', '{"saveMode":"automatic"}'::jsonb from generate_series(1,$2) n`, [daysAgo(120), RETENTION_BATCH + 7]);

  // editorial_notifications: المقروءة القديمة تُحذف، غير المقروءة القديمة والمقروءة الحديثة تبقى.
  await client.query(`insert into editorial_notifications(id,user_id,story_id,message,created_at,read_at) values
    ('n-read-old','u1','s1','م',$1,$1),('n-unread-old','u1','s1','م',$1,null),('n-read-new','u1','s1','م',$2,$2)`, [daysAgo(120), daysAgo(3)]);

  // story_versions: تبقى أحدث 50 لكل مادة بمعزل عن المادة الأخرى.
  await client.query(`insert into story_versions(id,story_id,version,data,actor,created_at)
    select 'v1-'||n, 's1', n, '{}'::jsonb, 'u1', $1 from generate_series(1,${RETENTION.versionsPerStory + 5}) n`, [now.toISOString()]);
  await client.query(`insert into story_versions(id,story_id,version,data,actor,created_at)
    select 'v2-'||n, 's2', n, '{}'::jsonb, 'u1', $1 from generate_series(1,3) n`, [now.toISOString()]);

  // ai_usage: أقدم من 13 شهرًا يُحذف.
  await client.query(`insert into ai_usage(id,at,tool,model,actor) values
    ('ai-old','2025-08-09T11:59:59.999Z','headlines','m','u1'),('ai-edge','2025-08-09T12:00:00.000Z','headlines','m','u1'),('ai-new',$1,'headlines','m','u1')`, [daysAgo(1)]);

  const report = await runRetentionCleanup(db, now);
  assert.deepEqual(report, { autosaveAudit: RETENTION_BATCH + 8, readNotifications: 1, storyVersions: 5, aiUsage: 1 });

  const ids = async (sql) => (await client.query(sql)).rows.map(row => row.id).sort();
  assert.deepEqual(await ids("select id from audit_log where id not like 'bulk-%'"), ['auto-edge', 'manual-old', 'no-context-old', 'publish-old']);
  assert.equal((await client.query("select count(*)::int n from audit_log where id like 'bulk-%'")).rows[0].n, 0);
  assert.deepEqual(await ids('select id from editorial_notifications'), ['n-read-new', 'n-unread-old']);
  const kept = (await client.query("select story_id, min(version) lo, max(version) hi, count(*)::int n from story_versions group by story_id order by story_id")).rows;
  assert.deepEqual(kept, [{ story_id: 's1', lo: 6, hi: 55, n: 50 }, { story_id: 's2', lo: 1, hi: 3, n: 3 }]);
  assert.deepEqual(await ids('select id from ai_usage'), ['ai-edge', 'ai-new']);

  // إعادة التشغيل لا تحذف شيئًا آخر.
  assert.deepEqual(await runRetentionCleanup(db, now), { autosaveAudit: 0, readNotifications: 0, storyVersions: 0, aiUsage: 0 });
  console.log(JSON.stringify({ retention: 'passed', firstRun: report }));
} finally {
  await client?.end();
  await admin.query(`drop database if exists "${database}"`);
  await admin.end();
}
