import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runScheduler, SCHEDULER_INTERVAL_MS } from './scheduler-loop.mjs';

// نفس السر داخل الحاوية والمجدول؛ يبقى CRON_SECRET المضبوط متاحًا للعامل الخارجي.
// لا نطبع السر ولا نخزنه في ملف أو نجعله متاحًا للمتصفح.
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const secret = process.env.CRON_SECRET?.trim() || randomBytes(32).toString('hex');
const server = spawn(process.execPath, [fileURLToPath(import.meta.resolve('next/dist/bin/next')), 'start', '-p', String(port)], {
  stdio: 'inherit', env: { ...process.env, CRON_SECRET: secret, ALELM_SCHEDULER_INTERVAL_MS: String(SCHEDULER_INTERVAL_MS) },
});
const controller = new AbortController();
let stopping = false, forceStop;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  controller.abort();
  server.kill(signal);
  forceStop = setTimeout(() => server.kill('SIGKILL'), 15000);
  forceStop.unref();
}
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
server.on('error', () => { controller.abort(); console.error('[server] failed to start'); process.exitCode = 1; });
server.on('exit', code => {
  controller.abort();
  clearTimeout(forceStop);
  process.exitCode = process.exitCode || code || (stopping ? 0 : 1);
});
console.log(JSON.stringify({ event: 'scheduler:started', intervalMs: SCHEDULER_INTERVAL_MS }));
runScheduler({ origin: `http://127.0.0.1:${port}`, secret, signal: controller.signal })
  .catch(() => { console.error('[scheduler] loop stopped unexpectedly'); process.exitCode = 1; stop('SIGTERM'); });
