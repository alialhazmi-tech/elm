import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { get } from 'node:http';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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
async function response(port, route) {
  return new Promise((resolve, reject) => {
    const request = get(`http://127.0.0.1:${port}${route}`, result => {
      result.resume();
      result.on('end', () => resolve(result));
    });
    request.setTimeout(10000, () => request.destroy(new Error('HTTP timeout')));
    request.on('error', reject);
  });
}
try {
  await symlink(path.resolve('node_modules'), path.join(directory, 'node_modules'), 'dir');
  await write('package.json', JSON.stringify({ private: true, type: 'module' }));
  await write('next.config.mjs', 'export default { experimental: { cpus: 2 } };');
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
} finally {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
  await rm(directory, { recursive: true, force: true });
}
