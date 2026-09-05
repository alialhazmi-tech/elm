import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { runScheduler } from '../scripts/scheduler-loop.mjs';

test('scheduler retries failures, reports recovery, and never overlaps requests', async () => {
  const controller = new AbortController();
  const events = [], waits = [];
  let calls = 0, active = 0, clock = 0;
  await runScheduler({ origin: 'http://127.0.0.1:3000', secret: 'private-test-secret', signal: controller.signal,
    now: () => clock, log: event => events.push(event),
    fetchImpl: async (url, options) => {
      assert.equal(url.pathname, '/api/tahrir/tick');
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.authorization, 'Bearer private-test-secret');
      assert.equal(++active, 1);
      await Promise.resolve();
      clock += 1200;
      active--;
      calls++;
      if (calls === 1) throw new Error('private-test-secret');
      if (calls === 2) return Response.json({ error: 'unavailable' }, { status: 503 });
      if (calls === 3) return Response.json({ ok: true, promoted: 1 });
      controller.abort();
      return Response.json({ ok: true, promoted: 0 });
    },
    sleep: async ms => { waits.push(ms); clock += ms; },
  });
  assert.equal(calls, 4);
  assert.ok(waits.every(ms => ms === 3800));
  assert.deepEqual(events, [
    { event: 'scheduler:unavailable', retryInMs: 5000 },
    { event: 'scheduler:tick', promoted: 1, recovered: true },
  ]);
  assert.ok(!JSON.stringify(events).includes('private-test-secret'));
});

test('scheduler makes authenticated loopback requests and aborts a pending request', async () => {
  const controller = new AbortController();
  let count = 0;
  const server = createServer((request, response) => {
    assert.equal(request.url, '/api/tahrir/tick');
    assert.equal(request.headers.authorization, 'Bearer local-only');
    count++;
    if (count === 1) { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{"ok":true,"promoted":0}'); }
    else controller.abort();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await runScheduler({ origin: `http://127.0.0.1:${server.address().port}`, secret: 'local-only',
      signal: controller.signal, intervalMs: 1, log: () => assert.fail('No warning for cancellation') });
    assert.equal(count, 2);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('scheduler cancellation interrupts its idle wait', async () => {
  const controller = new AbortController();
  let requests = 0;
  const pending = runScheduler({ origin: 'http://127.0.0.1', secret: 'test', signal: controller.signal,
    fetchImpl: async () => { requests++; setImmediate(() => controller.abort()); return Response.json({ ok: true, promoted: 0 }); },
    log: () => assert.fail('No failure expected'),
  });
  await pending;
  assert.equal(requests, 1);
});
