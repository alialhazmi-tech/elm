import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { normalizeArabic, toLatinDigits } from '../lib/policy/normalize.ts';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const source = process.env.TEST_DATABASE_URL;
if (!source || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error('Isolated TEST_DATABASE_URL named alelm_test* required');
if (!['localhost','127.0.0.1'].includes(new URL(source).hostname)) throw new Error('Local database required');
const database = 'alelm_test_search_' + process.pid;
const url = new URL(source); url.pathname = '/' + database;
const admin = new pg.Client({ connectionString: source }); await admin.connect();
await mkdir('tmp', { recursive: true });
const dir = await mkdtemp(process.cwd() + '/tmp/search-test-');
let client;
try {
  await admin.query('create database "' + database + '"');
  client = new pg.Client({ connectionString: url.href }); await client.connect();
  globalThis.__searchDb = drizzle(client);
  await migrate(globalThis.__searchDb, { migrationsFolder: 'drizzle' });
  await build({ stdin: { contents: "export { seedContentProvider, searchTokens } from './lib/content/provider'; export { stories } from './db/schema'; export { DATABASE_READINESS_SQL } from './lib/db-readiness';", resolveDir: process.cwd(), loader: 'ts' }, outfile: dir + '/subject.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: 'db', namespace: 'fixture' }));
    b.onResolve({ filter: /^next\/cache$/ }, () => ({ path: 'cache', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'db' ? 'export const getDb=()=>globalThis.__searchDb' : 'export const unstable_cache=(fn)=>fn; export const revalidateTag=()=>{};' }));
  } }] });
  const { seedContentProvider, searchTokens, stories, DATABASE_READINESS_SQL } = await import(dir + '/subject.mjs');
  const fixtures = [
    { title: 'الذَّكاء الاصطناعي في السُّعودية', excerpt: 'اقتصاد المستقبل', eyebrow: 'أخبار' },
    { title: 'التنجستن', excerpt: 'أسعار المعادن', keywords: ['صناعة', 'الرياض'] },
    { title: 'بيانات', keywords: null },
    { title: 'تاريخ', keywords: ['آثار', 'مسؤوليّة', 'إنتاج'] },
    { title: 'Numbers %_ 2030', keywords: { legacy: 'بحث' } },
    { title: 'الذكاء الاصطناعي', status: 'draft' },
    { title: 'دواء شائع للسكري قد يبطئ الشيخوخة' },
    { title: 'مادة أخرى', excerpt: 'أبحاث الشَّيخوخة', status:'draft' },
    { title: 'مادة صحية', excerpt: 'أبحاث الشَّيخوخة' },
    { title: 'تقرير', keywords:['الشيخوخة'] },
    { title: 'تنبيه', eyebrow:'الشيخوخة' },
    { title: 'مادة مؤرشفة', excerpt:'الشيخوخة',status:'archived' },
    { title: 'رُؤية ٢٠٣٠' },
  ];
  for (let i = 0; i < fixtures.length; i++) await globalThis.__searchDb.insert(stories).values({ id: 'fixture-' + i, slug: 'fixture-' + i, section: 'health', publishedAt: '2026-09-01T00:00:00Z', ...fixtures[i] });
  // Reproduce the previous schema on populated rows, then exercise the real repair migration.
  await client.query("alter table stories alter column search_text set expression as (translate(lower(title || ' ' || excerpt || ' ' || eyebrow || ' ' || coalesce(keywords::text,'')), 'أإآٱىةؤئًٌٍَُِّْٰـ', 'اايهوي'))");
  assert.equal((await seedContentProvider.search('الشيخوخة')).length,0);
  assert.ok((await client.query(DATABASE_READINESS_SQL)).rows.some(row=>row.missing==='public.stories.search_text.normalization'));
  const migration=await readFile('drizzle/0017_public_search_normalization.sql','utf8');
  const applyRepair=async()=>{await client.query('begin');try {await client.query(migration);await client.query('commit');}catch(error){await client.query('rollback');throw error;}};
  await applyRepair();
  const storage=(await client.query("select relfilenode from pg_class where oid='stories'::regclass")).rows[0].relfilenode;
  await applyRepair();
  assert.equal((await client.query("select relfilenode from pg_class where oid='stories'::regclass")).rows[0].relfilenode,storage,'Replaying the repair must not rewrite the table again');
  await client.query("insert into stories(id,slug,section,title,published_at) select 'bulk-'||n,'bulk-'||n,'health','أخبار متنوعة '||n,'2026-08-01' from generate_series(1,30000) n");
  // Known expectations catch the old SQL letter mapping bug independently of the index expression.
  assert.deepEqual(searchTokens('الشيخوخة'), ['شيخوخه']);
  const agingIds=(await seedContentProvider.search('الشيخوخة')).map(row=>row.id);
  assert.deepEqual(agingIds,['fixture-10','fixture-6','fixture-8','fixture-9']);
  assert.deepEqual((await seedContentProvider.search('الشيخوخه')).map(row=>row.id), agingIds);
  const normalize=value=>normalizeArabic(toLatinDigits(value)).toLowerCase();
  const checkParity = async () => {
    const sourceRows=(await client.query('select id,title,excerpt,eyebrow,keywords::text as keyword_text,status,published_at,search_text from stories order by published_at desc,id asc')).rows;
    const textFor=row=>normalize(`${row.title} ${row.excerpt} ${row.eyebrow} ${row.keyword_text??''}`);
    for (const row of sourceRows) assert.equal(row.search_text,textFor(row),row.id);
    for (const query of ['الشيخوخة','الشَّيخوخة','الشيخوخه','الذكاء الاصطناعي','الذكاء','السُّعودية','التنجستن','الرياض','مسؤولية','إنتاج','بحث','في','%_','no-match','2030','متنوعة','رؤية 2030','رؤيه ۲۰۳۰']) {
      const tokens=searchTokens(query);
      const expected=tokens.length?sourceRows.filter(row=>row.status==='published' && tokens.every(token=>textFor(row).includes(token))).slice(0,200).map(row=>row.id):[];
      const actual=await seedContentProvider.search(query);
      assert.deepEqual(actual.map(row=>row.id),expected,query);
      assert.ok(actual.every(row=>!Object.hasOwn(row,'searchText') && !Object.hasOwn(row,'editorSearchText')));
    }
  };
  await checkParity();
  // Every write path (including raw imports and Drizzle updates) refreshes the generated field.
  await client.query("update stories set title='تحديث',excerpt='الذكاء الاصطناعي',eyebrow='السعودية',keywords='[\"المعادن\"]'::jsonb where id='fixture-2'");
  await client.query("update stories set status='published' where id='fixture-5'");
  await checkParity();
  await client.query("update stories set status='archived' where id='fixture-0'");
  await checkParity();
  await client.query('vacuum analyze stories');
  // ASCII needle keeps index-plan verification portable to local databases with LC_CTYPE=C.
  // Arabic index use is separately benchmarked against the production-copy Neon branch.
  const plan = (await client.query("explain (format json) select id from stories where status='published' and search_text like '%numbers%'")).rows[0]['QUERY PLAN'];
  assert.match(JSON.stringify(plan), /stories_search_text_trgm_idx/);
  assert.equal((await client.query(DATABASE_READINESS_SQL)).rows.length, 0);
  await client.query('begin');
  await client.query('drop index stories_search_text_trgm_idx');
  assert.ok((await client.query(DATABASE_READINESS_SQL)).rows.some(r => r.missing === 'public.stories_search_text_trgm_idx'));
  await client.query('rollback');
  console.log('Public search passed: known aging results, 54 independently normalized result checks, digits, generated-text consistency, insert/update/publication/archive and index eligibility.');
} finally {
  await client?.end();
  await admin.query('drop database if exists "' + database + '"');
  await admin.end();
  delete globalThis.__searchDb;
  await rm(dir, { recursive: true, force: true });
}
