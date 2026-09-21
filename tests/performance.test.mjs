import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';

await mkdir('tmp', { recursive: true });
const dir = await mkdtemp(process.cwd() + '/tmp/performance-test-');
await build({ entryPoints: ['lib/performance/protocol.ts', 'lib/performance/navigation.ts', 'lib/performance/limit.ts', 'app/api/performance/route.ts'], outdir: dir, outbase: '.', bundle: true, platform: 'node', format: 'esm' });
const { publicPerformanceRoute: route, performanceInput } = await import(dir + '/lib/performance/protocol.js');
const { createNavigationTracker } = await import(dir + '/lib/performance/navigation.js');
const { createPerformanceLimiter } = await import(dir + '/lib/performance/limit.js');
const { POST } = await import(dir + '/app/api/performance/route.js');
const id = '9c07555c-6e99-44be-9e06-8b716fa678cf';
const event = () => ({ name: 'NAVIGATION', value: 1600, route: '/search', at: Date.now(), sample: 'slow', navigationId: id, outcome: 'complete' });

test('performance route allowlist strips search and content text and excludes private surfaces', () => {
  assert.equal(route('/search?q=private&token=secret'), '/search');
  assert.equal(route('/health/123/article-title?utm=anything'), '/health/123');
  assert.equal(route('/keywords/sensitive-keyword'), '/keywords/[keyword]');
  for (const path of ['/account', '/tahrir', '/join/reset?token=secret', '/api/auth', '/members/person', '/health/email@example.com', '/series/private', '//evil.test/search']) assert.equal(route(path), null);
  assert.equal(performanceInput([event()])?.length, 1);
  for (const patch of [{ route: '/search?q=secret' }, { route: '/account' }, { value: Infinity }, { value: -1 }, { name: '__proto__' }, { name: 'unknown' }, { value: 10 }, { at: 0 }, { secret: 'never log' }, { navigationId: 'user@email.test' }]) assert.equal(performanceInput([{ ...event(), ...patch }]), null);
  assert.equal(performanceInput(Array(9).fill(event())), null);
  assert.equal(performanceInput([{ ...event(), name: 'CLS', value: 0.12, outcome: undefined }])?.length, 1);
});

test('navigation tracks query-only commits, redirects, cancellation, timeouts and hidden documents', () => {
  let now = 0;
  const reports = [];
  const tracker = createNavigationTracker({ now: () => now, wallTime: () => 1000, id: () => id, report: x => reports.push(x), network: () => ({ networkMs: 700, ttfbMs: 600 }) });
  const origin = 'https://alelm.net';
  assert.equal(tracker.start('/search?q=second', '/search?q=first', origin), true);
  now = 2100;
  assert.equal(tracker.commit('/search', 'q=first'), false);
  assert.equal(tracker.commit('/search', 'q=second'), true);
  assert.equal(reports[0].value, 2100);
  assert.equal(reports[0].networkMs, 700);
  assert.equal(reports[0].route, '/search');
  assert.doesNotMatch(JSON.stringify(reports), /first|second/);
  assert.equal(tracker.commit('/search', 'q=second'), false);
  tracker.start('/health/123/old-slug', '/', origin);
  now += 400;
  tracker.commit('/health/123/canonical-slug', '');
  assert.equal(reports.at(-1).outcome, 'complete');
  tracker.start('/politics', '/', origin);
  now += 50;
  tracker.start('/health', '/', origin);
  assert.equal(reports.at(-1).outcome, 'superseded');
  assert.equal(tracker.commit('/politics', ''), false);
  now += 300;
  tracker.commit('/health', '');
  assert.equal(reports.at(-1).value, 300);
  tracker.start('/economy', '/', origin);
  now += 30000;
  tracker.finish('timeout');
  assert.equal(reports.at(-1).outcome, 'timeout');
  assert.equal(reports.at(-1).networkMs, undefined);
  tracker.start('/politics', '/', origin);
  tracker.finish('hidden');
  assert.equal(reports.at(-1).outcome, 'hidden');
  assert.equal(tracker.start('/account', '/', origin), false);
  assert.equal(tracker.start('/health', '/account', origin), false);
  assert.equal(tracker.start('/#same-document', '/', origin), false);
  assert.equal(tracker.start('https://other.test/search', '/', origin), false);
});

test('telemetry rate limits are bounded and reset without querying the database', () => {
  const allow = createPerformanceLimiter();
  for (let i = 0; i < 20; i++) assert.equal(allow('one', 100), true);
  assert.equal(allow('one', 100), false);
  for (let i = 0; i < 279; i++) assert.equal(allow('other-' + i, 100), true);
  assert.equal(allow('last', 100), false);
  assert.equal(allow('one', 60101), true);
});

test('telemetry endpoint only logs validated observations, rejects oversized bodies and cross-origin requests', async () => {
  const request = (body, extra = {}) => new Request('https://alelm.net/api/performance', { method: 'POST', headers: { origin: 'https://alelm.net', 'content-type': 'application/json', ...extra }, body });
  const logs = [], original = console.info;
  console.info = value => logs.push(JSON.parse(value));
  try {
    assert.equal((await POST(request(JSON.stringify([event()])))).status, 204);
    assert.equal(logs[0].event, 'web-performance');
    assert.equal(logs[0].route, '/search');
    assert.equal((await POST(request(JSON.stringify([{ ...event(), q: 'secret' }])))).status, 400);
    assert.equal((await POST(request(' '.repeat(4097)))).status, 413);
    assert.equal((await POST(request('not json'))).status, 400);
    assert.equal((await POST(request('[]', { origin: 'https://evil.test' }))).status, 403);
    assert.equal((await POST(request('[]', { 'sec-fetch-site': 'cross-site' }))).status, 403);
    assert.equal((await POST(request('[]', { 'content-type': 'text/plain' }))).status, 415);
    assert.equal(logs.length, 1);
    assert.doesNotMatch(JSON.stringify(logs), /secret|forwarded|cookie|userAgent/);
  } finally { console.info = original; }
});

test.after(() => rm(dir, { recursive: true, force: true }));

test('browser collector batches without cookies or referrers, samples fast metrics and records slow transitions', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  await build({ entryPoints: ['lib/performance/client.ts'], outfile: dir + '/client.js', bundle: true, platform: 'browser', format: 'iife', globalName: 'metrics' });
  const source = await readFile(dir + '/client.js', 'utf8');
  function browser(random) {
    let now = 0, sequence = 0;
    const timers = new Map(), listeners = new Map(), sent = [];
    const location = { href: 'https://alelm.net/', pathname: '/', origin: 'https://alelm.net' };
    const document = { visibilityState: 'visible' };
    const context = { window: {}, location, document, URL, crypto: { randomUUID: () => id }, Math: Object.assign(Object.create(Math), { random: () => random }),
      performance: { now: () => now, timeOrigin: Date.now(), getEntriesByType: () => [] },
      setTimeout: (fn, delay) => { timers.set(++sequence, { fn, due: now + delay }); return sequence; },
      clearTimeout: n => timers.delete(n),
      addEventListener: (name, fn) => listeners.set(name, fn),
      fetch: (url, options) => { sent.push({ url, ...options }); return Promise.resolve({ ok: true }); },
    };
    runInNewContext(source, context);
    const advance = ms => { now += ms; for (const [key, item] of timers) if (item.due <= now) { timers.delete(key); item.fn(); } };
    return { ...context, sent, advance, api: context.metrics, hide: () => { document.visibilityState = 'hidden'; listeners.get('visibilitychange')(); } };
  }
  const b = browser(0.8);
  b.api.initializePerformance();
  b.api.reportWebVital({ name: 'LCP', value: 100 });
  b.advance(2000);
  assert.equal(b.sent.length, 0);
  b.api.startNavigation('/search?q=private-query');
  b.advance(1800);
  b.location.pathname = '/search'; b.location.href = 'https://alelm.net/search?q=private-query';
  b.api.commitNavigation('/search', 'q=private-query');
  b.advance(2000);
  assert.equal(b.sent.length, 1);
  const report = JSON.parse(b.sent[0].body)[0];
  assert.equal(report.route, '/search'); assert.equal(report.value, 1800); assert.equal(report.sample, 'slow');
  assert.equal(b.sent[0].credentials, 'omit'); assert.equal(b.sent[0].referrerPolicy, 'no-referrer'); assert.equal(b.sent[0].keepalive, true);
  assert.doesNotMatch(b.sent[0].body, /private-query|https:/);
  b.api.reportWebVital({ name: 'INP', value: 500 });
  b.hide();
  assert.equal(b.sent.length, 2);
  b.location.pathname = '/account'; b.location.href = 'https://alelm.net/account';
  b.api.reportWebVital({ name: 'LCP', value: 8000 }); b.advance(3000);
  assert.equal(b.sent.length, 2);
  const sampled = browser(0.01);
  sampled.api.reportWebVital({ name: 'TTFB', value: 60 }); sampled.advance(2000);
  assert.equal(JSON.parse(sampled.sent[0].body)[0].sample, 'random');
  // Malfunctioning observers cannot emit unlimited requests.
  for (let i = 0; i < 100; i++) sampled.api.reportWebVital({ name: 'INP', value: 600 });
  sampled.advance(2000);
  assert.equal(sampled.sent.flatMap(x => JSON.parse(x.body)).length, 40);
});
