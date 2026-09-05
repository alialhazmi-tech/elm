import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Real production ISR responses: the first request previously emitted two raw
// Location headers, which HTTP/2 proxies combine into an invalid comma-joined URL.
const directory = await mkdtemp(path.join(tmpdir(), 'alelm-redirects-'));
const next = path.resolve('node_modules/next/dist/bin/next');
const env = { ...process.env, DATABASE_URL: '', NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production' };
delete env.NEXT_DIST_DIR;
let server;
let output = '';
async function write(name, value) {
  const target = path.join(directory, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, value);
}
async function response(port, route, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = httpRequest(`http://127.0.0.1:${port}${route}`, { method }, result => {
      result.resume();
      result.on('end', () => resolve(result));
    });
    request.setTimeout(10000, () => request.destroy(new Error('HTTP timeout')));
    request.on('error', reject);
    request.end();
  });
}
try {
  await symlink(path.resolve('node_modules'), path.join(directory, 'node_modules'), 'dir');
  await write('package.json', JSON.stringify({ private: true, type: 'module' }));
  await write('tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./*'] } } }));
  await write('lib/content/redirects.ts', await readFile('lib/content/redirects.ts', 'utf8'));
  await write('next.config.ts', `import {LEGACY_REDIRECTS} from './lib/content/redirects';
    export default { experimental: { cpus: 2 }, async redirects() {return LEGACY_REDIRECTS} };`);
  // Exercise the actual short-link handler and URL builder on a production server.
  // The provider boundary exposes a published story, or null for missing/draft IDs.
  await write('app/[section]/[id]/route.ts', await readFile('app/[section]/[id]/route.ts', 'utf8'));
  await write('lib/content/types.ts', await readFile('lib/content/types.ts', 'utf8'));
  await write('lib/content/provider.ts', `export const seedContentProvider = {
    async getStory(id: string): Promise<any> {
      if (id === '264631') return {id, section:'sciences', slug:'طعام-المستقبل'};
      return null;
    }
  };`);
  await write('app/[section]/[id]/[slug]/page.jsx', `export default async function Page({params}) {
    return <main>{(await params).id}</main> }`);
  await write('app/layout.jsx', 'export default function Layout({children}) { return <html><body>{children}</body></html> }');
  await write('app/page.jsx', 'export default function Page() {return <main>ready</main>}');
  for (const [route, method] of [['permanent', 'permanentRedirect'], ['temporary', 'redirect']]) {
    await write(`app/${route}/[id]/page.jsx`, `import {${method}} from 'next/navigation';
      export const revalidate=1; export function generateStaticParams(){return []}
      export default async function Page({params}) {const {id}=await params; ${method}('/target/'+encodeURIComponent(decodeURIComponent(id)))}`);
  }
  await write('app/target/[id]/page.jsx', 'export default async function Page({params}) {return <main>{(await params).id}</main>}');
  const build = spawn(process.execPath, [next, 'build', directory, '--webpack'], { cwd: directory, env });
  build.stdout.on('data', value => { output += value; });
  build.stderr.on('data', value => { output += value; });
  const [code] = await once(build, 'exit');
  assert.equal(code, 0, output);
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  server = spawn(process.execPath, [next, 'start', directory, '-p', String(port)], { cwd: directory, env });
  server.stdout.on('data', value => { output += value; });
  server.stderr.on('data', value => { output += value; });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await response(port, '/')).statusCode === 200) { ready = true; break; } } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, output);
  for (const [route, status] of [['permanent', 308], ['temporary', 307]]) {
    for (const phase of ['cold', 'cached', 'expired', 'regenerated']) {
      if (phase === 'expired' || phase === 'regenerated') await new Promise(resolve => setTimeout(resolve, 1500));
      const result = await response(port, `/${route}/arabic-%D8%AE%D8%A8%D8%B1`);
      const locations = result.rawHeaders.filter((_, index) => index % 2 === 0 && result.rawHeaders[index].toLowerCase() === 'location');
      assert.equal(result.statusCode, status, `${route} ${phase}`);
      assert.equal(locations.length, 1, `${route} ${phase}: duplicate raw Location headers`);
      assert.equal(result.headers.location, '/target/arabic-%D8%AE%D8%A8%D8%B1');
      assert.equal((await response(port, result.headers.location)).statusCode, 200);
    }
  }
  console.log('Canonical redirect regression: 307/308 cold, cached, expired and regenerated responses passed.');
  const canonical = '/sciences/264631/' + encodeURIComponent('طعام-المستقبل');
  for (const method of ['GET', 'HEAD']) {
    for (const route of ['/sciences/264631', '/old-section/264631', '/uncategorized/264631', '/' + encodeURIComponent('غير-مصنف') + '/264631']) {
      const result = await response(port, route, method);
      assert.equal(result.statusCode, 301, `${method} ${route}`);
      assert.equal(result.headers.location, canonical, `${method} ${route}: must redirect directly to the published canonical`);
      assert.equal(result.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === 'location').length, 1);
      assert.equal((await response(port, result.headers.location, method)).statusCode, 200);
    }
    for (const id of ['missing-id', 'draft-id', '264631' + '0'.repeat(64), '%20', '%2F']) {
      const result = await response(port, `/sciences/${id}`, method);
      assert.equal(result.statusCode, 404, `${method} ${id}`);
      assert.equal(result.headers.location, undefined);
      assert.equal(result.headers['cache-control'], 'no-store');
    }
  }
  const query = '?utm_source=x&ref=%D8%A7%D9%84%D8%B9%D9%84%D9%85';
  const slash = await response(port, '/sciences/264631/' + query);
  assert.equal(slash.statusCode, 308);
  assert.equal(slash.headers.location, '/sciences/264631' + query);
  const short = await response(port, slash.headers.location);
  assert.equal(short.statusCode, 301);
  assert.equal(short.headers.location, canonical + query);
  assert.equal((await response(port, short.headers.location)).statusCode, 200);
  console.log('Social short links: GET/HEAD, old sections, Arabic paths, query strings, trailing slash and missing/draft IDs passed.');
} finally {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
  await rm(directory, { recursive: true, force: true });
}
