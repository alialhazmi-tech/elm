import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const source = process.env.TEST_DATABASE_URL;
if (!source || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error('Isolated TEST_DATABASE_URL named alelm_test* required');
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
  ];
  for (let i = 0; i < fixtures.length; i++) await globalThis.__searchDb.insert(stories).values({ id: 'fixture-' + i, slug: 'fixture-' + i, section: 'health', publishedAt: '2026-09-01T00:00:00Z', ...fixtures[i] });
  await client.query("insert into stories(id,slug,section,title,published_at) select 'bulk-'||n,'bulk-'||n,'health','أخبار متنوعة '||n,'2026-08-01' from generate_series(1,30000) n");
  const old = "translate(lower(concat_ws(' ',title,excerpt,eyebrow,coalesce(keywords::text,''))),'أإآٱىةؤئًٌٍَُِّْٰـ','اايهوي')";
  const checkParity = async () => {
    assert.equal((await client.query('select count(*)::int as n from stories where search_text is distinct from ' + old)).rows[0].n, 0);
    for (const query of ['الذكاء الاصطناعي', 'الذكاء', 'السُّعودية', 'التنجستن', 'الرياض', 'مسؤولية', 'إنتاج', 'بحث', 'في', '%_', 'no-match', '2030', 'متنوعة']) {
      const tokens = searchTokens(query);
      const expected = tokens.length ? (await client.query("select id from stories where status='published' and " + tokens.map((_, i) => old + ' like $' + (i + 1)).join(' and ') + ' order by published_at desc,id asc limit 200', tokens.map(t => '%' + t + '%'))).rows.map(r => r.id) : [];
      const actual = await seedContentProvider.search(query);
      assert.deepEqual(actual.map(r => r.id), expected, query);
      assert.ok(actual.every(r => !Object.hasOwn(r, 'searchText')));
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
  console.log('Public search passed: 39 result-parity checks, generated-text consistency, insert/update/publication/archive and index eligibility.');
} finally {
  await client?.end();
  await admin.query('drop database if exists "' + database + '"');
  await admin.end();
  delete globalThis.__searchDb;
  await rm(dir, { recursive: true, force: true });
}
