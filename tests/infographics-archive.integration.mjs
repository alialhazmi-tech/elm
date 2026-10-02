import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const source = process.env.TEST_DATABASE_URL;
if (!source) throw new Error('Isolated TEST_DATABASE_URL required');
const url = new URL(source);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^alelm_test/.test(url.pathname.slice(1))) {
  throw new Error('Local alelm_test* database required');
}
const name = `alelm_test_infographics_${process.pid}`;
url.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: source });
await admin.connect();
await mkdir('tmp', { recursive: true });
const dir = await mkdtemp(`${process.cwd()}/tmp/infographics-test-`);
let client;
try {
  await admin.query(`create database "${name}"`);
  client = new pg.Client({ connectionString: url.href });
  await client.connect();
  globalThis.__infographicsDb = drizzle(client);
  await migrate(globalThis.__infographicsDb, { migrationsFolder: 'drizzle' });
  const modern = Array.from({ length: 20 }, (_, index) => ({
    id: `modern-${String(index).padStart(2, '0')}`,
    section: index % 2 ? 'economy' : 'health',
    format: 'infographics',
    publishedAt: '2026-10-01T12:00:00.000Z',
  }));
  const published = [
    ...modern,
    { id: 'legacy', section: 'infographics', format: 'news', publishedAt: '2026-09-01T12:00:00.000Z' },
    { id: 'both', section: 'infographics', format: 'infographics', publishedAt: '2026-09-02T12:00:00.000Z' },
    { id: 'boosted', section: 'economy', format: 'infographics', publishedAt: '2026-08-01T12:00:00.000Z', boostedAt: '2026-10-02T12:00:00.000Z' },
    { id: 'news', section: 'health', format: 'news', publishedAt: '2026-10-02T12:00:00.000Z' },
    { id: 'video-topic', section: 'health', format: 'videos', publishedAt: '2026-09-01T12:00:00.000Z' },
    { id: 'video-legacy', section: 'videos', format: 'news', publishedAt: '2026-08-01T12:00:00.000Z' },
  ].map(row => ({ slug: row.id, title: row.id, ...row }));
  globalThis.__infographicsSeed = published;
  await build({
    stdin: { contents: "export { pageBySection, seedContentProvider, listByFormat } from './lib/content/provider'; export { stories } from './db/schema';", resolveDir: process.cwd(), loader: 'ts' },
    outfile: `${dir}/subject.mjs`, bundle: true, platform: 'node', format: 'esm', packages: 'external',
    plugins: [{ name: 'isolate', setup(b) {
      b.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: 'db', namespace: 'fixture' }));
      b.onResolve({ filter: /^next\/cache$/ }, () => ({ path: 'cache', namespace: 'fixture' }));
      b.onResolve({ filter: /^\.\/seed$/ }, args => args.importer.endsWith('/lib/content/provider.ts') ? { path: 'seed', namespace: 'fixture' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: {
        db: 'export const getDb=()=>globalThis.__infographicsDb;',
        cache: 'export const unstable_cache=fn=>fn; export const revalidateTag=()=>{};',
        seed: 'export const seedStories=globalThis.__infographicsSeed; export const seedVideos=[]; export const SECTION_NAMES={infographics:"إنفوجرافيك",health:"صحة",economy:"اقتصاد",videos:"فيديو"};',
      }[args.path] }));
    } }],
  });
  const { pageBySection, seedContentProvider, listByFormat, stories } = await import(`${dir}/subject.mjs`);
  await globalThis.__infographicsDb.insert(stories).values([
    ...published,
    ...['draft', 'scheduled', 'archived'].map(status => ({ id: status, slug: status, title: status, status, section: 'infographics', format: 'infographics', publishedAt: '2026-10-03T12:00:00.000Z' })),
  ]);
  const ids = rows => rows.map(row => row.id);
  const expected = ['boosted', ...modern.map(row => row.id), 'both', 'legacy'];
  const verify = async label => {
    const first = await pageBySection('infographics', undefined);
    const second = await pageBySection('infographics', '2');
    assert.equal(first.total, 23, `${label}: modern and legacy rows counted once`);
    assert.equal(first.pageCount, 2);
    assert.deepEqual([first.from, first.to, second.from, second.to], [1, 18, 19, 23]);
    assert.deepEqual(ids([...first.items, ...second.items]), expected, `${label}: complete stable archive order`);
    assert.deepEqual(ids(await seedContentProvider.listBySection('infographics')), expected);
    assert.deepEqual(ids((await pageBySection('infographics', '999')).items), ids(second.items));
    const home = await listByFormat('infographics', 9);
    assert.deepEqual(ids(first.items.slice(0, 9)), ids(home), `${label}: latest homepage graphics appear in archive`);
    const health = await pageBySection('health', '1');
    assert.equal(health.total, 12);
    assert.ok(health.items.every(row => row.section === 'health'), `${label}: topical sections stay scoped`);
    assert.deepEqual(ids((await pageBySection('videos', '1')).items), ['video-topic', 'video-legacy']);
    assert.deepEqual(ids(await seedContentProvider.listBySection('videos')), ['video-topic', 'video-legacy']);
  };
  await verify('Postgres');
  globalThis.__infographicsDb = null;
  await verify('seed');
  console.log('Infographics archive passed: modern/legacy membership, no duplicates, hidden statuses excluded, recency, pagination, homepage parity, topic/video preservation, SQL and seed.');
} finally {
  delete globalThis.__infographicsDb;
  delete globalThis.__infographicsSeed;
  await client?.end();
  await admin.query(`drop database if exists "${name}"`);
  await admin.end();
  await rm(dir, { recursive: true, force: true });
}
