import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { decodeJwt, importPKCS8, SignJWT } from 'jose';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../src/app.mjs';
import { openStore, createOwner, revokeRegistration, hash } from '../src/store.mjs';
import { JWT_GRANT, CLAIM_GRANT, SCOPE } from '../src/credentials.mjs';
import { contentReader } from '../src/content.mjs';
import { serve } from '../src/server.mjs';
import { fixtureServer } from './fixture.mjs';

const issuer = 'http://127.0.0.1:4318';
const password = 'a-unique-test-password-never-production';
const email = 'owner@example.test';
async function env(t, limits = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'alelm-auth-test-'));
  const file = join(directory, 'isolated.sqlite');
  const fixture = await fixtureServer();
  const logs = []; let clock = 1800000000;
  let db = openStore(file);
  const options = () => ({ db, issuer, upstream: fixture.url, now: () => clock, audit: e => logs.push(e),
    limits: { registrationsPerMinute: 100, requestsPerMinute: 1000, globalPerMinute: 1000, ...limits } });
  let app = await createApp(options());
  t.after(async () => { db.close(); await fixture.close(); rmSync(directory, { recursive: true }); });
  const request = (path, { method = 'GET', body, headers = {}, form = false, token, ip = 'test' } = {}) => app(new Request(`${issuer}${path}`, {
    method, headers: { ...(body ? { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body ? { body: typeof body === 'string' ? body : form ? new URLSearchParams(body).toString() : JSON.stringify(body) } : {}),
  }), ip);
  const post = (path, body, more = {}) => request(path, { method: 'POST', body, ...more });
  const register = async () => {
    const response = await post('/agent/identity', { type: 'anonymous' });
    assert.equal(response.status, 200); return response.json();
  };
  const exchange = (assertion, extra = {}) => post('/oauth2/token', { grant_type: JWT_GRANT,
    assertion, resource: `${issuer}/api`, ...extra }, { form: true });
  const access = async reg => { const response = await exchange(reg.identity_assertion); assert.equal(response.status, 200); return response.json(); };
  return { request, post, register, exchange, access, fixture, logs, file,
    db: () => db, advance: seconds => { clock += seconds; },
    restart: async () => { db.close(); db = openStore(file); app = await createApp(options()); } };
}

async function claimStart(e, reg, owner = email) {
  const response = await e.post('/agent/identity/claim', { claim_token: reg.claim_token, email: owner });
  assert.equal(response.status, 200);
  const claim = await response.json();
  const url = new URL(claim.claim_attempt.verification_uri);
  const view = await e.request(`${url.pathname}${url.search}`);
  assert.equal(view.status, 200);
  const html = await view.text();
  return { claim, body: { email: owner, password, user_code: claim.claim_attempt.user_code,
    claim_attempt_token: new URLSearchParams(url.hash.slice(1)).get('attempt'), csrf: /name="csrf" value="([^"]+)"/.exec(html)[1] },
    headers: { Origin: issuer, Cookie: view.headers.get('set-cookie').split(';')[0] } };
}
const finish = (e, started, body = {}) => e.post('/agent/identity/claim/complete', { ...started.body, ...body }, { form: true, headers: started.headers });
const poll = (e, reg) => e.post('/oauth2/token', { grant_type: CLAIM_GRANT, claim_token: reg.claim_token, resource: `${issuer}/api` }, { form: true });

test('discovery is internally consistent and advertises only implemented public-read flows', async t => {
  const e = await env(t);
  const asResponse = await e.request('/.well-known/oauth-authorization-server');
  const as = await asResponse.json();
  const prm = await (await e.request('/.well-known/oauth-protected-resource/api')).json();
  assert.equal(as.issuer, issuer);
  assert.deepEqual(prm.authorization_servers, [as.issuer]);
  assert.deepEqual(as.grant_types_supported, [JWT_GRANT, CLAIM_GRANT]);
  assert.deepEqual(as.agent_auth.identity_types_supported, ['anonymous']);
  assert.deepEqual(prm.scopes_supported, [SCOPE]);
  assert.deepEqual(prm.bearer_methods_supported, ['header']);
  assert.equal(prm.resource, `${issuer}/api`);
  assert.equal(asResponse.headers.get('access-control-allow-origin'), '*');
  const jwks = await (await e.request('/.well-known/jwks.json')).json();
  assert.equal(jwks.keys.length, 1); assert.equal(jwks.keys[0].d, undefined);
  const doc = await e.request('/auth.md'); assert.match(doc.headers.get('content-type'), /text\/markdown/);
  assert.match(await doc.text(), /^# auth.md/);
  assert.equal((await e.request('/.well-known/openid-configuration')).status, 404);
});

test('anonymous registration exchanges for bounded read-only tokens; reads work without site login', async t => {
  const e = await env(t); const reg = await e.register(); const token = await e.access(reg);
  assert.equal(token.expires_in, 300); assert.equal(token.scope, SCOPE); assert.equal(token.refresh_token, undefined);
  const response = await e.request('/api/search?q=علوم', { token: token.access_token, headers: { Cookie: 'member=never-forward-me' } });
  assert.equal(response.status, 200); assert.equal((await response.json()).items[0].id, 'fixture-1');
  assert.equal((await e.request('/api/articles/fixture-1', { token: token.access_token })).status, 200);
  assert.equal(e.fixture.requests.length, 2);
  for (const req of e.fixture.requests) {
    assert.equal(req.method, 'GET'); assert.equal(req.headers.authorization, undefined); assert.equal(req.headers.cookie, undefined);
    assert.ok(req.url.startsWith('/api/content/v1/'));
  }
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('resource denies missing, cookie-only, query-string and tampered credentials with discovery challenge', async t => {
  const e = await env(t); const token = (await e.access(await e.register())).access_token;
  const invalid = `${token.slice(0, -40)}A${token.slice(-39)}`;
  for (const options of [{}, { headers: { Cookie: `token=${token}` } }, { token: invalid }]) {
    const response = await e.request('/api/search?q=علوم', options);
    assert.equal(response.status, 401); assert.match(response.headers.get('www-authenticate'), /resource_metadata=/);
  }
  assert.equal((await e.request(`/api/search?q=x&access_token=${token}`)).status, 401);
  assert.equal(e.fixture.requests.length, 0);
});

test('token exchange rejects additional scopes, wrong audience, unsupported grants, and provider assertions', async t => {
  const e = await env(t); const reg = await e.register();
  assert.equal((await (await e.exchange(reg.identity_assertion, { scope: 'news:write' })).json()).error, 'invalid_scope');
  assert.equal((await (await e.exchange(reg.identity_assertion, { resource: 'https://alelm.net/mcp' })).json()).error, 'invalid_target');
  assert.equal((await (await e.exchange(reg.identity_assertion, { grant_type: 'password' })).json()).error, 'unsupported_grant_type');
  assert.equal((await e.post('/agent/identity', { type: 'identity_assertion', assertion: 'untrusted' })).status, 400);
  assert.equal((await e.post('/agent/identity', { type: 'anonymous', scope: 'admin' })).status, 400);
});

test('signed tokens with wrong audience, issuer, scope or token kind are rejected', async t => {
  const e = await env(t); const reg = await e.register(); const access = await e.access(reg);
  const privatePEM = JSON.parse(e.db().prepare("SELECT value FROM settings WHERE key='signing-key'").get().value).privateKey;
  const key = await importPKCS8(privatePEM, 'EdDSA');
  const original = decodeJwt(access.access_token);
  for (const changes of [{ aud: 'https://wrong.test' }, { iss: 'https://wrong.test' }, { scope: 'admin' }, { kind: 'assertion' }, { version: 999 }]) {
    const forged = await new SignJWT({ ...original, ...changes }).setProtectedHeader({ alg: 'EdDSA', typ: 'at+jwt' }).sign(key);
    assert.equal((await e.request('/api/search?q=x', { token: forged })).status, 401);
  }
  assert.equal((await e.request('/api/search?q=x', { token: reg.identity_assertion })).status, 401);
  assert.equal((await e.exchange(access.access_token)).status, 400);
});

test('expiry is enforced for both access tokens and registration assertions', async t => {
  const e = await env(t); const reg = await e.register(); const token = await e.access(reg);
  e.advance(301);
  assert.equal((await e.request('/api/search?q=x', { token: token.access_token })).status, 401);
  assert.equal((await e.exchange(reg.identity_assertion)).status, 200);
  e.advance(86400);
  assert.equal((await e.exchange(reg.identity_assertion)).status, 400);
  assert.equal(e.db().prepare('SELECT count(*) AS n FROM registrations').get().n, 0);
});

test('durable token revocation survives restart; registration revocation stops future issuance across connections', async t => {
  const e = await env(t); const reg = await e.register(); const token = await e.access(reg);
  await e.restart(); assert.equal((await e.request('/api/search?q=x', { token: token.access_token })).status, 200);
  assert.equal((await e.post('/oauth2/revoke', { token: token.access_token, token_type_hint: 'access_token' }, { form: true })).status, 200);
  await e.restart(); assert.equal((await e.request('/api/search?q=x', { token: token.access_token })).status, 401);
  assert.equal((await e.exchange(reg.identity_assertion)).status, 200);
  const operator = openStore(e.file); revokeRegistration(operator, reg.registration_id); operator.close();
  assert.equal((await e.exchange(reg.identity_assertion)).status, 400);
  assert.equal((await e.post('/oauth2/revoke', { token: 'unknown' }, { form: true })).status, 200);
  assert.equal((await e.post('/oauth2/revoke', {}, { form: true })).status, 400);
});

test('full optional human claim rotates credentials, preserves scope, and permits owner revocation', async t => {
  const e = await env(t); await createOwner(e.db(), email, password);
  const reg = await e.register(); const before = await e.access(reg); const started = await claimStart(e, reg);
  assert.equal((await (await poll(e, reg)).json()).error, 'authorization_pending');
  assert.equal((await (await poll(e, reg)).json()).error, 'slow_down');
  assert.equal((await finish(e, started)).status, 200);
  assert.equal((await e.exchange(reg.identity_assertion)).status, 400);
  assert.equal((await e.request('/api/search?q=x', { token: before.access_token })).status, 401);
  e.advance(11); const after = await (await poll(e, reg)).json();
  assert.equal(after.scope, SCOPE); assert.ok(after.identity_assertion);
  assert.equal((await e.request('/api/search?q=x', { token: after.access_token })).status, 200);
  assert.equal((await poll(e, reg)).status, 400);
  assert.equal((await finish(e, started)).status, 403);
  const view = await e.request('/owner/revoke'); const html = await view.text();
  const response = await e.post('/owner/revoke', { email, password, registration_id: reg.registration_id,
    csrf: /name="csrf" value="([^"]+)"/.exec(html)[1] }, { form: true,
    headers: { Origin: issuer, Cookie: view.headers.get('set-cookie').split(';')[0] } });
  assert.equal(response.status, 200);
  assert.equal((await e.exchange(after.identity_assertion)).status, 400);
  assert.equal((await e.request('/api/search?q=x', { token: after.access_token })).status, 401);
});

test('claim denies absent credentials, wrong owner, CSRF and rebinding; wrong-code retries are bounded', async t => {
  const e = await env(t); await createOwner(e.db(), email, password); await createOwner(e.db(), 'other@example.test', password);
  const reg = await e.register(); const started = await claimStart(e, reg);
  assert.equal((await finish(e, started, { password: 'wrong' })).status, 403);
  assert.equal((await finish(e, started, { email: 'other@example.test' })).status, 403);
  assert.equal((await finish(e, started, { csrf: 'wrong' })).status, 403);
  assert.equal((await e.post('/agent/identity/claim/complete', started.body, { form: true })).status, 403);
  assert.equal((await e.post('/agent/identity/claim', { claim_token: reg.claim_token, email: 'other@example.test' })).status, 409);
  const wrongCode = started.body.user_code === '000000' ? '000001' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await finish(e, started, { user_code: wrongCode })).status, 403);
  assert.equal((await finish(e, started)).status, 403);
});

test('expired claim cannot be approved or rebound, and another owner cannot revoke it', async t => {
  const e = await env(t); await createOwner(e.db(), email, password); const reg = await e.register(); const started = await claimStart(e, reg);
  e.advance(601);
  assert.equal((await finish(e, started)).status, 403);
  assert.equal((await (await poll(e, reg)).json()).error, 'expired_token');
  assert.equal((await e.post('/owner/revoke', { ...started.body, registration_id: reg.registration_id }, { form: true, headers: started.headers })).status, 403);
});

test('concurrent claim completion has one winner and invalidates old credentials', async t => {
  const e = await env(t); await createOwner(e.db(), email, password);
  const reg = await e.register(); const started = await claimStart(e, reg);
  const replies = await Promise.all([finish(e, started), finish(e, started)]);
  assert.deepEqual(replies.map(r => r.status).sort(), [200, 403]);
  assert.equal((await e.exchange(reg.identity_assertion)).status, 400);
});

test('registration capacity and rate limits fail closed without unbounded storage', async t => {
  const e = await env(t, { registrationsPerMinute: 2, maxRegistrations: 2 });
  await e.register(); await e.register();
  const limited = await e.post('/agent/identity', { type: 'anonymous' });
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '60');
  e.advance(61); assert.equal((await e.post('/agent/identity', { type: 'anonymous' })).status, 503);
  assert.equal(e.db().prepare('SELECT count(*) AS n FROM registrations').get().n, 2);
});

test('private paths, writes, path traversal and arbitrary URL parameters never reach upstream', async t => {
  const e = await env(t); const token = (await e.access(await e.register())).access_token;
  for (const path of ['/api/viewer', '/api/admin', '/api/articles/%2e%2e%2fadmin', '/tahrir', '/api/search?q=x&url=https://evil.test']) {
    assert.ok((await e.request(path, { token })).status >= 400);
  }
  assert.equal((await e.post('/api/articles/fixture-1', { title: 'write' }, { token })).status, 404);
  assert.equal((await e.request('/api/articles/fixture-1', { token, method: 'DELETE' })).status, 405);
  assert.equal(e.fixture.requests.length, 0);
});

test('malformed and oversized requests, foreign Origin and duplicate form parameters are rejected', async t => {
  const e = await env(t);
  assert.equal((await e.post('/agent/identity', '{')).status, 400);
  assert.equal((await e.post('/agent/identity', { type: 'anonymous', padding: 'x'.repeat(17000) })).status, 413);
  assert.equal((await e.post('/agent/identity', { type: 'anonymous' }, { headers: { Origin: 'https://evil.test' } })).status, 403);
  assert.equal((await e.post('/oauth2/token', 'resource=x&resource=y', { form: true })).status, 400);
  assert.equal((await e.post('/agent/identity', { type: 'anonymous' }, { form: true })).status, 415);
});

test('audit logs and stored rows do not contain raw credentials; private key remains server-only', async t => {
  const e = await env(t); await createOwner(e.db(), email, password);
  const reg = await e.register(); const token = await e.access(reg); const started = await claimStart(e, reg);
  await finish(e, started);
  const log = JSON.stringify(e.logs);
  for (const value of [password, email, reg.identity_assertion, reg.claim_token, token.access_token, started.body.claim_attempt_token]) assert.ok(!log.includes(value));
  const stored = JSON.stringify(e.db().prepare('SELECT * FROM registrations').all()) + JSON.stringify(e.db().prepare('SELECT * FROM claims').all()) + JSON.stringify(e.db().prepare('SELECT * FROM owners').all());
  for (const value of [password, reg.claim_token, reg.identity_assertion, token.access_token, started.body.claim_attempt_token]) assert.ok(!stored.includes(value));
  assert.equal(e.db().prepare('SELECT claim_hash FROM registrations').get().claim_hash, hash(reg.claim_token));
  assert.equal(statSync(e.file).mode & 0o777, 0o600);
  assert.ok(e.logs.every(item => Object.keys(item).every(k => ['event', 'requestId', 'registrationId'].includes(k))));
});

test('upstream failures, redirects, non-JSON and oversized responses fail safely', async () => {
  for (const response of [() => { throw new Error('secret connection detail'); },
    () => Response.redirect('https://evil.test'), () => new Response('not json'),
    () => Response.json({ value: 'x'.repeat(2_000_001) })]) {
    const reader = contentReader('https://alelm.net', response);
    await assert.rejects(reader('read', { id: 'fixture-1' }), error => error.code === 'upstream_unavailable' && !error.message.includes('secret'));
  }
});

test('local HTTP MCP SDK client initializes, lists only two read tools, and reads a fixture', async t => {
  const fixture = await fixtureServer();
  const service = await serve({ file: ':memory:', port: 0, upstream: fixture.url, audit: () => {} });
  t.after(async () => { await service.close(); await fixture.close(); });
  const reg = await (await fetch(`${service.issuer}/agent/identity`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"type":"anonymous"}' })).json();
  const credential = await (await fetch(`${service.issuer}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: JWT_GRANT, assertion: reg.identity_assertion, resource: `${service.issuer}/api` }) })).json();
  const client = new Client({ name: 'integration-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${service.issuer}/api/mcp`), { requestInit: { headers: { Authorization: `Bearer ${credential.access_token}` } } });
  await client.connect(transport); t.after(() => client.close());
  assert.deepEqual((await client.listTools()).tools.map(v => v.name).sort(), ['read_article', 'search_articles']);
  assert.equal((await client.callTool({ name: 'search_articles', arguments: { query: 'علوم' } })).structuredContent.items[0].id, 'fixture-1');
  assert.equal((await client.callTool({ name: 'read_article', arguments: { id: 'fixture-1' } })).structuredContent.publisher, 'العلم');
  const unknown = await client.callTool({ name: 'publish_article', arguments: {} });
  assert.equal(unknown.isError, true);
  const spoofedHost = await new Promise((resolve, reject) => {
    const req = httpRequest(`${service.issuer}/api/search?q=x`, { headers: { Host: 'evil.test' } }, res => {
      res.resume(); resolve(res.statusCode);
    }); req.on('error', reject); req.end();
  });
  assert.equal(spoofedHost, 400);
  assert.equal((await fetch(`${service.issuer}/agent/identity`, { method: 'POST', body: 'x'.repeat(17000) })).status, 413);
  await client.close();
});

test('configuration rejects non-loopback HTTP issuers, arbitrary upstreams, and sharing a store between issuers', async t => {
  const e = await env(t);
  await assert.rejects(createApp({ db: e.db(), issuer: 'http://insecure.test' }), /HTTPS/);
  await assert.rejects(createApp({ db: e.db(), issuer, upstream: 'https://evil.test' }), /Unsafe upstream/);
  await assert.rejects(createApp({ db: e.db(), issuer: 'https://different.test' }), /separate store/);
});

test('service package has no site database, login or CMS imports', () => {
  for (const name of ['app', 'content', 'credentials', 'server', 'store']) {
    const text = readFileSync(new URL(`../src/${name}.mjs`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /DATABASE_URL|NEON_AUTH|lib\/membership|lib\/tahrir|@\/|drizzle|postgres/);
  }
});

test('storage failure returns 503 rather than silently downgrading authentication', async t => {
  const e = await env(t); const token = await e.access(await e.register());
  e.db().exec('ALTER TABLE registrations RENAME TO unavailable_registrations');
  const response = await e.request('/api/search?q=x', { token: token.access_token });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'temporarily_unavailable');
  assert.equal(e.fixture.requests.length, 0);
  assert.ok(e.logs.some(item => item.event === 'internal_error'));
});

test('owner password lock persists across restarts and eventually expires', async t => {
  const e = await env(t); await createOwner(e.db(), email, password);
  const reg = await e.register(); const started = await claimStart(e, reg);
  for (let i = 0; i < 10; i++) assert.equal((await finish(e, started, { password: 'incorrect' })).status, 403);
  await e.restart(); assert.equal((await finish(e, started)).status, 403);
  e.advance(1801);
  const next = await claimStart(e, await e.register());
  assert.equal((await finish(e, next)).status, 200);
});

test('claim credential delivery has one winner when two polling requests overlap', async t => {
  const e = await env(t); await createOwner(e.db(), email, password);
  const reg = await e.register(); const started = await claimStart(e, reg);
  assert.equal((await finish(e, started)).status, 200);
  const responses = await Promise.all([poll(e, reg), poll(e, reg)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
});

test('upstream traffic is capped globally even across different registrations', async () => {
  let requests = 0;
  const reader = contentReader('https://alelm.net', async () => { requests++; return Response.json({ items: [] }); });
  for (let i = 0; i < 30; i++) await reader('search', { query: 'x' });
  await assert.rejects(reader('search', { query: 'y' }), error => error.status === 429);
  assert.equal(requests, 30);
});
