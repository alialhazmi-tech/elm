import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

// Production Next server with the actual loader and image route; isolated storage fixture.
const directory = await mkdtemp(path.join(tmpdir(), 'alelm-images-'));
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
  await write('tsconfig.json', JSON.stringify({ compilerOptions: { allowImportingTsExtensions: true, baseUrl: '.', paths: { '@/*': ['./*'] } } }));
  await write('next.config.mjs', `export default { experimental: {cpus:2}, images: {
    loader:'custom', loaderFile:'./lib/image-variant-loader.ts', deviceSizes:[360,640,1080,1600], imageSizes:[168]
  } };`);
  for (const file of ['app/image-variants/route.ts', 'lib/image-source.ts', 'lib/image-variant-loader.ts', 'lib/image-variants.ts', 'lib/sharing-image.ts', 'lib/sharing.ts', 'lib/sharing-contract.ts']) {
    await write(file, await readFile(file, 'utf8'));
  }
  const source = await sharp({create:{width:1200,height:900,channels:3,background:'#b56d3a'}}).png().toBuffer();
  await write('source.png', source);
  await write('lib/storage/images.ts', `import {readFile,appendFile} from 'node:fs/promises';
    export async function getStoredImage(filename:string) {
      if(filename.startsWith('00000000')) throw {name:'NoSuchKey'};
      if(filename.startsWith('11111111')) throw new Error('temporary storage failure');
      await appendFile('source-reads.txt','read\\n');
      return {bytes:await readFile('source.png')};
    }
    export function isMissingStoredImage(error:any){return error?.name==='NoSuchKey'}
  `);
  await write('app/layout.jsx', 'export default function Layout({children}) {return <html><body>{children}</body></html>}');
  await write('app/page.jsx', `import Image from 'next/image';
    export default function Page() {return <Image src='/uploads/621a297f-10bd-40a5-87ee-67e0a54b5c28.webp' alt='editorial image' width={84} height={84}/>}`);
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
  const origin = `http://127.0.0.1:${port}`;
  const home = await (await fetch(origin)).text();
  assert.match(home, /srcSet="[^"]*image-variants/);
  assert.match(home, /w=168/);
  const src = '/uploads/621a297f-10bd-40a5-87ee-67e0a54b5c28.webp';
  const target = '/image-variants?src='+encodeURIComponent(src)+'&w=168&v=1';
  const first = await fetch(origin+target);
  assert.equal(first.status,200);
  assert.equal(first.headers.get('content-type'),'image/webp');
  assert.match(first.headers.get('cache-control'), /s-maxage=604800/);
  const bytes = Buffer.from(await first.arrayBuffer());
  const meta = await sharp(bytes).metadata();
  assert.deepEqual([meta.width,meta.height],[168,126]);
  const second = await fetch(origin+target);
  assert.deepEqual(Buffer.from(await second.arrayBuffer()),bytes);
  assert.equal((await readFile(path.join(directory,'source-reads.txt'),'utf8')).trim(),'read');
  const head = await fetch(origin+target,{method:'HEAD'});
  assert.equal(head.status,200);
  assert.equal(head.headers.get('content-length'),String(bytes.length));
  for(const invalid of [
    '/image-variants?src='+encodeURIComponent(src)+'&w=9999',
    '/image-variants?src='+encodeURIComponent('http://127.0.0.1/api/private')+'&w=168',
    '/image-variants?src='+encodeURIComponent('https://dash.alelm.net/admin')+'&w=168',
  ]) {
    const r=await fetch(origin+invalid,{redirect:'manual'});
    assert.equal(r.status,400);
    assert.equal(r.headers.get('cache-control'),'no-store');
  }
  for(const [prefix,status] of [['00000000',404],['11111111',307]]) {
    const image='/uploads/'+prefix+'-10bd-40a5-87ee-67e0a54b5c28.webp';
    const r=await fetch(origin+'/image-variants?src='+encodeURIComponent(image)+'&w=168',{redirect:'manual'});
    assert.equal(r.status,status);
    assert.equal(r.headers.get('cache-control'),'no-store');
    if(status===307) assert.equal(r.headers.get('location'),image);
  }
  console.log('Image delivery: real Next loader/srcset, resized WebP, cache hit, HEAD, invalid sources, missing images and original fallback passed.');
} finally {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
  await rm(directory, { recursive: true, force: true });
}
