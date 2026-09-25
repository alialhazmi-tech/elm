import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const source = process.env.TEST_DATABASE_URL;
if (!source || !['localhost', '127.0.0.1'].includes(new URL(source).hostname) || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error('Local isolated TEST_DATABASE_URL required');
const database = 'alelm_test_editor_search_' + process.pid;
const url = new URL(source); url.pathname = '/' + database;
const admin = new pg.Client({ connectionString: source }); await admin.connect();
await mkdir('tmp', { recursive: true });
const dir = await mkdtemp(process.cwd() + '/tmp/editor-search-');
let client;
try {
  await admin.query('create database "' + database + '"');
  client = new pg.Client({ connectionString: url.href }); await client.connect();
  globalThis.__editorSearchDb = drizzle(client);
  globalThis.__editorSearchDb.batch = async queries => {
    await client.query('begin');
    try { const rows=[]; for (const query of queries) rows.push(await query); await client.query('commit'); return rows; }
    catch (error) { await client.query('rollback'); throw error; }
  };
  await migrate(globalThis.__editorSearchDb, { migrationsFolder: 'drizzle' });
  // The additive migration must be safe to repeat, including its function and index.
  await client.query(await readFile('drizzle/0016_editor_content_search.sql', 'utf8'));
  await build({ stdin: { contents: `export { listPage, listPageForReview, countPage, getStory } from './lib/tahrir/service'; export { publishCheckedStory } from './lib/tahrir/workflow'; export { appStoryList } from './lib/tahrir/app-read'; export { normalizeStorySearch, storySearchWhere } from './lib/tahrir/story-search'; export { stories } from './db/schema'; export { DATABASE_READINESS_SQL } from './lib/db-readiness';`, resolveDir: process.cwd(), loader: 'ts' }, outfile: dir + '/subject.cjs', bundle: true, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({ filter: /^@\/lib\/db$|^next\/cache$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === '@/lib/db' ? 'export const getDb=()=>globalThis.__editorSearchDb' : 'export const unstable_cache=(fn)=>fn; export const revalidateTag=()=>{};' }));
  } }] });
  const { listPage, listPageForReview, countPage, getStory, publishCheckedStory, appStoryList, normalizeStorySearch, stories, DATABASE_READINESS_SQL } = (await import(dir + '/subject.cjs')).default;
  for (const [text, expected] of [
    ['أإآٱىةؤئ', 'اااايهوي'], ['السُّعوديـة إِنْتَاج', 'السعوديه انتاج'],
    ['٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹', '0123456789 0123456789'], ['<p>AI</p> &nbsp; <b>2030</b>', 'ai 2030'],
    ['\u200f\u0610نتيجة\u2067', 'نتيجه'], ['100%_\\', '100%_\\'],
  ]) {
    assert.equal(normalizeStorySearch(text), expected);
    assert.equal((await client.query('select alelm_editor_search_normalize($1) as value', [text])).rows[0].value, expected);
  }
  const fixtures = [
    { id:'exact', title:'الذكاء الاصطناعي', updatedAt:'2020-01-01' },
    { id:'phrase', title:'مستقبل الذكاء الاصطناعي', updatedAt:'2021-01-01' },
    { id:'reordered', title:'الاصطناعي ومستقبل الذكاء', updatedAt:'2022-01-01' },
    { id:'metadata', title:'تقنيات جديدة', excerpt:'الذكاء', keywords:['الاصطناعي'], updatedAt:'2023-01-01' },
    { id:'body', title:'مادة شاملة', body:'<p>تطور الذكاء</p><p>الاصطناعي في السُّعوديـة عام ٢٠٣٠</p>', updatedAt:'2026-01-01' },
    { id:'partial', title:'الذكاء البشري' },
    { id:'hidden', title:'الذكاء الاصطناعي', status:'archived' },
    { id:'review', title:'رُؤْية إِنْتَاج', status:'review', body:'تجربة سنة ۲۰۳۱' },
    { id:'literal', title:'خصم 100%_ خاص' },
    { id:'html', title:'روابط', body:'<a href="https://secret.example">محتوى مرئي</a>' },
  ];
  for (const row of fixtures) await globalThis.__editorSearchDb.insert(stories).values({ slug:row.id, section:'health', status:'published', seriesSlug:'absat', publishedAt:'2026-01-01', ...row });
  const ids = async (q, status, extra={}) => (await listPage(status,1,100,{q,...extra})).map(r=>r.id);
  const ordered=['exact','phrase','reordered','metadata','body'];
  assert.deepEqual(await ids('الذكاء الاصطناعي'), ordered);
  assert.deepEqual(new Set(await ids('الاصطناعي الذكاء')), new Set(ordered));
  assert.deepEqual(await ids('السعودية 2030'), ['body']);
  assert.deepEqual(await ids('رؤية انتاج','review'), ['review']);
  assert.deepEqual(await ids('تجربة 2031'), ['review']);
  assert.deepEqual(await ids('الذكاء الاصطناعي','archived'), ['hidden']);
  assert.deepEqual(await ids('%_'), ['literal']);
  for (const q of ['secret.example', "' OR 1=1 --", 'غيرموجود', 'َـ', '!!!']) assert.deepEqual(await ids(q), [], q);
  assert.deepEqual(await ids('الذكاء الاصطناعي',undefined,{seriesSlug:'aghrab'}), []);
  assert.equal(await countPage(undefined,{q:'الذكاء الاصطناعي'}), ordered.length);
  const pages=[];
  for(let page=1;page<=3;page++) {
    const rows=await listPage(undefined,page,2,{q:'الذكاء الاصطناعي'});
    const review=await listPageForReview(undefined,page,2,{q:'الذكاء الاصطناعي'});
    assert.deepEqual(review.map(row=>{ const lite={...row}; delete lite.body; delete lite.authorId; delete lite.assignedTo; return lite; }),rows);
    pages.push(...rows.map(r=>r.id));
  }
  assert.deepEqual(pages, ordered);
  await globalThis.__editorSearchDb.insert(stories).values({id:'ownership',slug:'ownership',section:'health',title:'مادة إسناد',status:'published',seriesSlug:'absat',publishedAt:'2026-01-01',authorId:'fixture-author',assignedTo:'fixture-assignee'});
  const ownershipReview=await listPageForReview(undefined,1,10,{q:'مادة إسناد'});
  assert.equal(ownershipReview.length,1);
  assert.equal(ownershipReview[0].authorId,'fixture-author');
  assert.equal(ownershipReview[0].assignedTo,'fixture-assignee');
  const actor={userId:'test',can:()=>true};
  const app=await appStoryList(actor,{q:'الذكاء الاصطناعي'});
  assert.equal(app.total,ordered.length);assert.deepEqual(app.rows.map(r=>r.id),ordered);
  // Raw imports/updates and Drizzle writes refresh the stored search text without a background job.
  await client.query("update stories set body='المحتوى البديل' where id='body'");
  assert.deepEqual(await ids('السعودية 2030'), []);
  assert.deepEqual(await ids('المحتوى البديل'), ['body']);
  await globalThis.__editorSearchDb.update(stories).set({excerpt:'محتوى محدّث للبحث'}).where((await import('drizzle-orm')).eq(stories.id,'body'));
  assert.deepEqual(await ids('محدث للبحث'), ['body']);
  await globalThis.__editorSearchDb.insert(stories).values({id:'revision',slug:'revision',section:'health',title:'نسخة معدلة',body:'حقائق مستجدة',status:'draft',revisionOf:'exact',baseVersion:1});
  await publishCheckedStory(await getStory('revision'),'fixture','test revision');
  assert.deepEqual(await ids('حقائق مستجدة'), ['exact']);
  assert.equal((await client.query("select count(*)::int n from story_versions where story_id='exact' and data->'story' ? 'editor_search_text'")).rows[0].n,0,'Derived search data is not duplicated in version history');
  await client.query("insert into stories(id,slug,section,title,body) select 'bulk-'||n,'bulk-'||n,'health','مادة عامة '||n,repeat('معلومات سياقية ',30) from generate_series(1,10000) n");
  await client.query("update stories set body='UniqueNeedle content' where id='body'");
  await client.query('vacuum analyze stories');
  const plan=(await client.query("explain (analyze,buffers,format json) select id from stories where status <> 'archived' and editor_search_text like '%uniqueneedle%'" )).rows[0]['QUERY PLAN'][0];
  assert.match(JSON.stringify(plan.Plan),/stories_editor_search_trgm_idx/);
  assert.deepEqual(await ids('UniqueNeedle'), ['body']);
  const shortPlan=(await client.query("explain (analyze,format json) select count(*) from stories where editor_search_text like '%م%'" )).rows[0]['QUERY PLAN'][0];
  assert.ok(shortPlan['Execution Time'] < 1000, 'Short searches must scan stored text without re-normalizing every body');
  assert.equal((await client.query(DATABASE_READINESS_SQL)).rows.length,0);
  await client.query('drop index stories_editor_search_trgm_idx');
  assert.ok((await client.query(DATABASE_READINESS_SQL)).rows.some(r=>r.missing==='public.stories_editor_search_trgm_idx'));
  console.log(JSON.stringify({result:'Editor search passed: Arabic/digits, ranking, full content, filters, pagination, web/app parity, literal wildcards, updates, migration readiness and indexed lookup.',fixtureCount:10010,indexLookupMs:plan['Execution Time'],shortLookupMs:shortPlan['Execution Time']}));
} finally {
  await client?.end(); await admin.query('drop database if exists "' + database + '"'); await admin.end();
  delete globalThis.__editorSearchDb;
  await rm(dir,{recursive:true,force:true});
}
