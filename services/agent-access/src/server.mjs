import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.mjs';
import { openStore, configureSigningGeneration } from './store.mjs';
import { deploymentConfig, backupConfig } from './config.mjs';
import { backupManager, s3Storage, restoreSnapshot } from './backup.mjs';

export async function serve({ file = resolve('data/agent-access.sqlite'), port = 4318, issuer,
  upstream = 'https://alelm.net', audit = event => console.info(JSON.stringify(event)), now, limits,
  production = false, generation, backup: backupOptions, storage } = {}) {
  if (production && (!issuer?.startsWith('https://') || !generation || !backupOptions)) throw new Error('Incomplete production configuration');
  const db = openStore(file);
  let app; let actualIssuer; let backups; let ready = false;
  const server = createServer({ maxHeaderSize: 16384, requestTimeout: 10000, headersTimeout: 10000 }, async (req, res) => {
    const reject = status => { res.writeHead(status, { 'Cache-Control': 'no-store', Connection: 'close' }); res.end(); };
    const healthHost = production && req.headers.host === 'healthcheck.railway.app';
    const healthRequest = req.url === '/health' && ['GET', 'HEAD'].includes(req.method);
    if (!actualIssuer || (req.headers.host !== new URL(actualIssuer).host && !(healthHost && healthRequest))) return reject(400);
    if (healthRequest) {
      let healthy = ready && (!production || backups?.healthy());
      try { db.prepare('SELECT 1').get(); } catch { healthy = false; }
      res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
      return res.end(req.method === 'HEAD' ? '' : JSON.stringify({ status: healthy ? 'ok' : 'unavailable', mode: 'isolated-public-read' }));
    }
    if (!ready) return reject(503);
    // Railway terminates TLS. Identity and quotas never use caller-controlled forwarded IP headers.
    if (production && req.headers['x-forwarded-proto'] !== 'https') return reject(400);
    if (Number(req.headers['content-length'] ?? 0) > 16384) return reject(413);
    const chunks = []; let size = 0;
    const timer = setTimeout(() => { reject(408); req.destroy(); }, 10000);
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16384) { clearTimeout(timer); return reject(413); }
        chunks.push(chunk);
      }
      clearTimeout(timer);
      const method = req.method ?? 'GET';
      if (['GET', 'HEAD'].includes(method) && size) return reject(400);
      // Concatenate only origin-relative targets; absolute-form and // URLs cannot redirect the handler.
      if (!req.url?.startsWith('/') || req.url.startsWith('//')) return reject(400);
      const request = new Request(`${actualIssuer}${req.url}`, { method, headers: req.headers,
        ...(size ? { body: Buffer.concat(chunks) } : {}) });
      const response = await app(request, production ? 'public-edge' : req.socket.remoteAddress ?? 'unknown');
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      if (!res.headersSent) reject(503); else res.end();
    } finally { clearTimeout(timer); }
  });
  server.maxConnections = 32;
  server.keepAliveTimeout = 5000;
  try {
    await new Promise((done, reject) => { server.once('error', reject); server.listen(port, production ? '0.0.0.0' : '127.0.0.1', done); });
    actualIssuer = issuer ?? `http://127.0.0.1:${server.address().port}`;
    if (production && configureSigningGeneration(db, generation)) audit({ event: 'signing_key_rotated_all_registrations_revoked' });
    app = await createApp({ db, issuer: actualIssuer, upstream, audit, now, limits });
    if (production) {
      backups = backupManager({ db, issuer: actualIssuer, key: backupOptions.key,
        storage: storage ?? s3Storage(backupOptions), audit });
      await backups.run();
    }
    ready = true;
  } catch (error) { server.close(); await backups?.close(); db.close(); throw error; }
  return { issuer: actualIssuer, db, server, close: async () => {
    ready = false;
    await new Promise(done => { server.close(done); server.closeIdleConnections(); });
    await backups?.close(); db.close();
  } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.umask(0o077);
  const config = deploymentConfig(process.env);
  if (process.env.AGENT_RESTORE_OBJECT) {
    const backup = backupConfig(process.env); const storage = s3Storage(backup);
    try { await restoreSnapshot({ storage, key: backup.key, objectKey: process.env.AGENT_RESTORE_OBJECT,
      issuer: config.issuer, target: config.file }); } finally { storage.close(); }
    console.info(JSON.stringify({ event: 'backup_restored_all_registrations_revoked' }));
  }
  const running = await serve(config);
  console.info(JSON.stringify({ event: 'service_ready', issuer: running.issuer, production: config.production }));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await running.close(); process.exit(0); });
}
