import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { tmpdir } from 'node:os';

// A real production Next server, isolated files only: no database or deployed writes.
const directory = await mkdtemp(path.join(tmpdir(), 'alelm-public-cache-'));
await symlink(path.resolve('node_modules'), path.join(directory, 'node_modules'), 'dir');
let server;
let output = '';
async function write(name, contents) {
  const target = path.join(directory, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}
const next = path.resolve('node_modules/next/dist/bin/next');
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: '', NODE_ENV: 'production' };
delete env.NEXT_DIST_DIR;
try {
  await write('package.json', JSON.stringify({ private: true, type: 'module' }));
  await write('tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*'] } } }));
  await write('next.config.mjs', 'export default { experimental: { cpus: 2 } };');
  await write('lib/content/cache-policy.ts', await readFile('lib/content/cache-policy.ts', 'utf8'));
  await write('lib/content/cache.ts', await readFile('lib/content/cache.ts', 'utf8'));
  await write('lib/performance/server.ts', await readFile('lib/performance/server.ts', 'utf8'));
  await write('lib/tahrir/revalidatePublic.ts', await readFile('lib/tahrir/revalidatePublic.ts', 'utf8'));
  await write('lib/content/provider.ts', 'export { invalidatePublicContent as invalidateCorpus } from "./cache";');
  await write('state.json', JSON.stringify({ title: 'initial', published: true }));
  await write('store.ts', `
    import { readFile, appendFile, writeFile } from 'node:fs/promises';
    import { cachedPublicQuery } from './lib/content/cache';
    export function getContent(key = 'story') {
      return cachedPublicQuery(key, 300000, async () => {
        await appendFile('reads.txt', key + '\\n');
        const item = JSON.parse(await readFile('state.json', 'utf8'));
        if (key === 'race') {
          await writeFile('race-started', '1');
          while (!(await readFile('race-release', 'utf8').catch(() => ''))) {
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        }
        return item;
      });
    }
  `);
  await write('app/layout.tsx', 'export default function Layout({children}) { return <html><body>{children}</body></html> }');
  await write('app/page.tsx', `import {getContent} from '../store'; export const revalidate=300;
    export default async function Page(){const item=await getContent('home');return <main>{item.published?item.title:'absent'}</main>}`);
  for (const route of ['[section]', '[section]/[id]/[slug]', 'series/[slug]', 'keywords/[keyword]']) {
    await write(`app/${route}/page.tsx`, `import {getContent} from '@/store';
      export const revalidate=300; export function generateStaticParams(){return []}
      export default async function Page(){const item=await getContent('listing');return <main>{item.published?item.title:'absent'}</main>}`);
  }
  await write('app/api/read/route.ts', `import {getContent} from '@/store';
    import {PUBLIC_CONTENT_CACHE_CONTROL} from '@/lib/content/cache-policy';
    export async function GET(){return Response.json(await getContent('api'),{headers:{'Cache-Control':PUBLIC_CONTENT_CACHE_CONTROL}})}`);
  await write('app/api/race/route.ts', `import {getContent} from '@/store'; export async function GET(){return Response.json(await getContent('race'))}`);
  await write('app/api/publish/route.ts', `import {writeFile} from 'node:fs/promises';
    import {revalidatePublicStory} from '@/lib/tahrir/revalidatePublic';
    export async function POST(request){await writeFile('state.json',JSON.stringify(await request.json()));
      revalidatePublicStory({section:'health',id:'story-id',slug:'story-slug'}); return Response.json({ok:true})}`);
  const build = spawn(process.execPath, [next, 'build', '--webpack'], { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'] });
  build.stdout.on('data', chunk => { output += chunk; });
  build.stderr.on('data', chunk => { output += chunk; });
  const [code] = await once(build, 'exit');
  assert.equal(code, 0, output);
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  server = spawn(process.execPath, [next, 'start', '-H', '127.0.0.1', '-p', String(port)], { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { await fetch(origin + '/api/read'); break; } catch {
      if (attempt === 119) throw new Error(output);
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  // Publish a fresh value after the fixture build, then warm each route.
  const publish = async value => {
    const response = await fetch(origin + '/api/publish', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(value) });
    assert.equal(response.status, 200, await response.text());
  };
  const paths = ['/', '/health', '/health/story-id/story-slug', '/series/example', '/keywords/example', '/api/read'];
  async function check(expected) {
    for (const route of paths) {
      const response = await fetch(origin + route);
      assert.equal(response.status, 200, route);
      const body = await response.text();
      if (route === '/api/read') {
        const item = JSON.parse(body);
        assert.equal(item.published ? item.title : 'absent', expected, route);
        assert.equal(response.headers.get('Cache-Control'), 'public, no-cache, must-revalidate');
      } else assert.ok(body.includes('<main>' + expected + '</main>'), `${route}: first response did not contain ${expected}`);
    }
  }
  await publish({ title: 'version-one', published: true });
  await check('version-one');
  const warmReads = await readFile(path.join(directory, 'reads.txt'), 'utf8');
  await check('version-one');
  assert.equal(await readFile(path.join(directory, 'reads.txt'), 'utf8'), warmReads, 'warm cache must avoid source reads');
  await publish({ title: 'version-two', published: true });
  await check('version-two');
  await publish({ title: 'version-two', published: false });
  await check('absent');
  await publish({ title: 'new-publication', published: true });
  await check('new-publication');
  const oldRequest = fetch(origin + '/api/race');
  const raceDeadline = Date.now() + 10000;
  while (!(await readFile(path.join(directory, 'race-started'), 'utf8').catch(() => ''))) {
    assert.ok(Date.now() < raceDeadline, 'race fixture did not start');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  await publish({ title: 'after-inflight-publish', published: true });
  await writeFile(path.join(directory, 'race-release'), '1');
  await (await oldRequest).text();
  const afterRace = await fetch(origin + '/api/race');
  assert.equal((await afterRace.json()).title, 'after-inflight-publish', 'an old inflight query must not repopulate the cache after publish');
  console.log('PASS: production Next cache hits avoid source reads; first request sees publish, approved update, archive, and republish across 6 routes; in-flight pre-publish reads cannot refill stale data.');
} catch (error) {
  console.error(output.slice(-12000));
  throw error;
} finally {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
  await rm(directory, { recursive: true, force: true });
}
