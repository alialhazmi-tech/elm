import { setTimeout as delay } from 'node:timers/promises';

export const SCHEDULER_INTERVAL_MS = 5000;

/** حلقة واحدة في حاوية الويب؛ لا تتداخل الطلبات ولا تعتمد على فتح لوحة التحكم. */
export async function runScheduler({ origin, secret, signal, intervalMs = SCHEDULER_INTERVAL_MS,
  fetchImpl = fetch, log = message => console.log(JSON.stringify(message)), sleep = delay, now = Date.now }) {
  if (!secret) throw new Error('Scheduler secret is required');
  const endpoint = new URL('/api/tahrir/tick', origin);
  let failed = false, lastWarning = -Infinity;
  while (!signal.aborted) {
    const started = now();
    try {
      const response = await fetchImpl(endpoint, { method: 'POST',
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]), redirect: 'error' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.ok !== true || !Number.isInteger(result.promoted) || result.promoted < 0) throw new Error('Invalid scheduler response');
      if (failed || result.promoted) log({ event: 'scheduler:tick', promoted: result.promoted, recovered: failed });
      failed = false;
    } catch {
      if (signal.aborted) break;
      failed = true;
      if (now() - lastWarning >= 60000) {
        log({ event: 'scheduler:unavailable', retryInMs: intervalMs });
        lastWarning = now();
      }
    }
    try { await sleep(Math.max(0, intervalMs - (now() - started)), undefined, { signal }); }
    catch { if (!signal.aborted) throw new Error('Scheduler timer failed'); }
  }
}
