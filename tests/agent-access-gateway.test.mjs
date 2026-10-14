import test from 'node:test';
import assert from 'node:assert/strict';
import { agentAccessGateway, AGENT_AUTHORITY } from '../lib/agents/access-gateway.ts';

const req = (path, options = {}) => new Request('https://alelm.net/api/agents' + path, {
  ...options, headers: { Authorization: 'Bearer example.jwt.signature', ...options.headers },
});

test('gateway forwards only fixed read routes and bearer headers, never website session or edge secrets', async () => {
  const seen = [];
  const backend = async (url, options) => { seen.push({ url, options }); return Response.json({ items: [] }, {
    headers: { 'Set-Cookie': 'untrusted=1', 'X-Internal-Secret': 'hidden' },
  }); };
  const response = await agentAccessGateway(req('/search?q=علوم&page=1', { headers: {
    Cookie: 'member=private; editor=private', 'X-Alelm-Origin-Token': 'secret', 'X-Forwarded-For': '192.0.2.1',
    'X-Host': 'attacker.test', Origin: 'https://alelm.net',
  } }), backend);
  assert.equal(response.status, 200);
  assert.equal(seen[0].url, AGENT_AUTHORITY + '/site-api/search?q=%D8%B9%D9%84%D9%88%D9%85&page=1');
  assert.deepEqual([...seen[0].options.headers.keys()], ['accept', 'authorization']);
  assert.equal(seen[0].options.redirect, 'error'); assert.equal(seen[0].options.credentials, 'omit');
  assert.equal(response.headers.get('set-cookie'), null); assert.equal(response.headers.get('x-internal-secret'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('gateway blocks private routes, arbitrary targets, writes, foreign origins and missing tokens before network', async () => {
  const offline = async () => { assert.fail('No request should reach the backend'); };
  for (const path of ['/admin', '/oauth2/token', '/agent/identity', '/articles/../admin', '//attacker.test', '/articles/%2Fprivate']) {
    assert.equal((await agentAccessGateway(req(path), offline)).status, 404, path);
  }
  for (const path of ['/search?url=https://attacker.test', '/search?q=a&q=b', '/articles/123?token=secret']) {
    assert.equal((await agentAccessGateway(req(path), offline)).status, 400, path);
  }
  assert.equal((await agentAccessGateway(req('/search?q=a', { method: 'POST' }), offline)).status, 404);
  assert.equal((await agentAccessGateway(req('/search?q=a', { headers: { Origin: 'https://attacker.test' } }), offline)).status, 403);
  const missing = await agentAccessGateway(req('/search?q=a', { headers: { Authorization: '', Cookie: 'token=anything' } }), offline);
  assert.equal(missing.status, 401); assert.match(missing.headers.get('www-authenticate'), /https:\/\/alelm.net\/\.well-known\/oauth-protected-resource/);
});

test('MCP bodies and upstream responses are bounded; failures never become successful anonymous access', async () => {
  const json = { 'Content-Type': 'application/json', 'Mcp-Protocol-Version': '2025-11-25' };
  assert.equal((await agentAccessGateway(req('/mcp', { method: 'POST', headers: json, body: ' '.repeat(16385) }), async () => { assert.fail(); })).status, 413);
  let forwarded;
  const accepted = await agentAccessGateway(req('/mcp', { method: 'POST', headers: json, body: '{"jsonrpc":"2.0"}' }), async (url, options) => {
    forwarded = { url, options }; return new Response(null, { status: 202 });
  });
  assert.equal(accepted.status, 202); assert.equal(forwarded.url, AGENT_AUTHORITY + '/site-api/mcp');
  assert.equal(forwarded.options.headers.get('mcp-protocol-version'), '2025-11-25');
  for (const response of [new Response('html'), Response.json({ content: 'x'.repeat(2_000_001) }), new Response('{', { headers: { 'Content-Type': 'application/json' } })]) {
    assert.equal((await agentAccessGateway(req('/search?q=a'), async () => response)).status, 503);
  }
  assert.equal((await agentAccessGateway(req('/search?q=a'), async () => { throw new Error('private failure'); })).status, 503);
  const denied = await agentAccessGateway(req('/search?q=a'), async () => Response.json({ error: 'invalid_token' }, { status: 401 }));
  assert.equal(denied.status, 401); assert.match(denied.headers.get('www-authenticate'), /resource_metadata=/);
});
