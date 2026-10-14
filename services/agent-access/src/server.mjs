import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.mjs';
import { openStore } from './store.mjs';

export async function serve({ file = resolve('data/agent-access.sqlite'), port = 4318, issuer,
  upstream = 'https://alelm.net', audit, now, limits } = {}) {
  const db = openStore(file);
  let app; let actualIssuer;
  const server = createServer({ maxHeaderSize: 16384, requestTimeout: 10000, headersTimeout: 10000 }, async (req, res) => {
    const reject = status => { res.writeHead(status, { 'Cache-Control': 'no-store', Connection: 'close' }); res.end(); };
    // Bind locally, reject Host spoofing, never trust forwarded headers for identity or quotas.
    if (!app || req.headers.host !== new URL(actualIssuer).host) return reject(400);
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
      const response = await app(request, req.socket.remoteAddress ?? 'unknown');
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      if (!res.headersSent) reject(503); else res.end();
    } finally { clearTimeout(timer); }
  });
  server.maxConnections = 32;
  server.keepAliveTimeout = 5000;
  try {
    await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
    actualIssuer = issuer ?? `http://127.0.0.1:${server.address().port}`;
    app = await createApp({ db, issuer: actualIssuer, upstream, audit, now, limits });
  } catch (error) { server.close(); db.close(); throw error; }
  return { issuer: actualIssuer, db, server, close: async () => {
    await new Promise(done => { server.close(done); server.closeIdleConnections(); }); db.close();
  } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.env.NODE_ENV === 'production') throw new Error('Preview only: production rollout requires a separate review');
  process.umask(0o077);
  const running = await serve({ file: resolve(process.env.AGENT_DATA_FILE ?? 'data/agent-access.sqlite'),
    port: Number(process.env.AGENT_PORT ?? 4318), issuer: process.env.AGENT_ISSUER });
  console.info(`Independent agent access preview: ${running.issuer} (loopback only)`);
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await running.close(); process.exit(0); });
}
