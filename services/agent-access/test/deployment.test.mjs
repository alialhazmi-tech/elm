import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { request } from 'node:http';
import { openStore, consumeRate, configureSigningGeneration, createOwner } from '../src/store.mjs';
import { createApp } from '../src/app.mjs';
import { deploymentConfig } from '../src/config.mjs';
import { encryptSnapshot, decryptSnapshot, backupManager, restoreSnapshot } from '../src/backup.mjs';
import { serve } from '../src/server.mjs';
import { JWT_GRANT } from '../src/credentials.mjs';

const issuer = 'https://agents.example.test';
function temporary(t) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-deployment-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function storage() {
  const objects = new Map();
  return { objects, put: async (key, value) => objects.set(key, value), get: async key => objects.get(key),
    list: async () => [...objects.keys()].sort(), remove: async key => objects.delete(key), close() {} };
}
const appRequest = (app, path, body, form = false) => app(new Request(issuer + path, {
  ...(body ? { method: 'POST', headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
    body: form ? new URLSearchParams(body) : JSON.stringify(body) } : {}),
}));
const register = async app => (await appRequest(app, '/agent/identity', { type: 'anonymous' })).json();
const exchange = (app, reg) => appRequest(app, '/oauth2/token', { grant_type: JWT_GRANT, assertion: reg.identity_assertion, resource: issuer + '/api' }, true);

test('production configuration requires HTTPS, its mounted volume, and complete encrypted backup settings', () => {
  const env = { NODE_ENV: 'production', PORT: '8080', AGENT_DEPLOYMENT: 'railway', RAILWAY_ENVIRONMENT_ID: 'test',
    AGENT_ISSUER: issuer, RAILWAY_VOLUME_MOUNT_PATH: '/data', AGENT_DATA_FILE: '/data/agents.sqlite',
    AGENT_SIGNING_GENERATION: '1', AGENT_BACKUP_ENDPOINT: 'https://storage.example.test', AGENT_BACKUP_BUCKET: 'agents',
    AGENT_BACKUP_REGION: 'ams', AGENT_BACKUP_ACCESS_KEY_ID: 'test', AGENT_BACKUP_SECRET_ACCESS_KEY: 'test', AGENT_BACKUP_KEY: 'ab'.repeat(32) };
  assert.equal(deploymentConfig(env).port, 8080);
  for (const changes of [{ AGENT_ISSUER: 'http://agents.example.test' }, { AGENT_ISSUER: issuer + '/' },
    { AGENT_DATA_FILE: '/data/../ephemeral.sqlite' }, { AGENT_DATA_FILE: '/database/a.sqlite' },
    { RAILWAY_VOLUME_MOUNT_PATH: '' }, { AGENT_SIGNING_GENERATION: '' }, { AGENT_BACKUP_KEY: 'bad' },
    { AGENT_BACKUP_SECRET_ACCESS_KEY: '' }, { AGENT_DEPLOYMENT: '' }, { PORT: '0' }]) {
    assert.throws(() => deploymentConfig({ ...env, ...changes }));
  }
});

test('rate quotas survive restart and expire at the original deadline', t => {
  const file = join(temporary(t), 'rate.sqlite'); let db = openStore(file);
  assert.equal(consumeRate(db, 'register:public-edge', 1, 1000), true);
  db.close(); db = openStore(file);
  try {
    assert.equal(consumeRate(db, 'register:public-edge', 1, 1001), false);
    assert.equal(consumeRate(db, 'register:public-edge', 1, 1061), true);
  } finally { db.close(); }
});

test('key generation rotation invalidates existing registrations and persists across restart', async t => {
  const file = join(temporary(t), 'rotation.sqlite'); let db = openStore(file);
  const make = () => createApp({ db, issuer, audit: () => {} });
  configureSigningGeneration(db, 'one'); let app = await make(); const reg = await register(app);
  const first = await (await appRequest(app, '/.well-known/jwks.json')).json();
  assert.equal((await exchange(app, reg)).status, 200);
  assert.equal(configureSigningGeneration(db, 'two'), true); app = await make();
  const second = await (await appRequest(app, '/.well-known/jwks.json')).json();
  assert.notDeepEqual(first, second); assert.equal((await exchange(app, reg)).status, 400);
  db.close(); db = openStore(file);
  try {
    assert.equal(configureSigningGeneration(db, 'two'), false); app = await make();
    assert.deepEqual(await (await appRequest(app, '/.well-known/jwks.json')).json(), second);
    assert.equal((await exchange(app, reg)).status, 400);
  } finally { db.close(); }
});

test('authenticated encrypted snapshots restore safely without reviving old credentials or overwriting a store', async t => {
  const dir = temporary(t); const db = openStore(join(dir, 'original.sqlite')); const remote = storage();
  const key = randomBytes(32); const events = [];
  const app = await createApp({ db, issuer, audit: () => {} }); const reg = await register(app);
  await createOwner(db, 'restore@example.test', 'unique-test-owner-password');
  const manager = backupManager({ db, issuer, key, storage: remote, audit: event => events.push(event) });
  try {
    assert.equal(manager.healthy(), false); await manager.run(); assert.equal(manager.healthy(), true);
    assert.equal(events[0].event, 'backup_verified');
    const objectKey = [...remote.objects.keys()][0]; const encrypted = remote.objects.get(objectKey);
    assert.equal(encrypted.includes(Buffer.from('SQLite format 3')), false);
    assert.throws(() => decryptSnapshot(encrypted, randomBytes(32)));
    const corrupted = Buffer.from(encrypted); corrupted[corrupted.length - 1] ^= 1;
    assert.throws(() => decryptSnapshot(corrupted, key));
    const target = join(dir, 'restored.sqlite');
    await assert.rejects(restoreSnapshot({ storage: remote, key, objectKey, issuer: 'https://wrong.test', target }));
    assert.equal(existsSync(target), false);
    await restoreSnapshot({ storage: remote, key, objectKey, issuer, target });
    const restored = openStore(target);
    try {
      const recovered = await createApp({ db: restored, issuer, audit: () => {} });
      assert.equal(restored.prepare('SELECT count(*) AS n FROM owners').get().n, 0);
      assert.equal((await exchange(recovered, reg)).status, 400);
      assert.equal((await exchange(recovered, await register(recovered))).status, 200);
    } finally { restored.close(); }
    await assert.rejects(restoreSnapshot({ storage: remote, key, objectKey, issuer, target }), /EEXIST/);
  } finally { await manager.close(); db.close(); }
});

test('backup failure cannot be reported healthy and ciphertext is randomized', async t => {
  const db = openStore(join(temporary(t), 'failed.sqlite')); await createApp({ db, issuer });
  const remote = storage(); remote.put = async () => { throw new Error('offline'); };
  const key = randomBytes(32); const bytes = Buffer.from('private');
  assert.notDeepEqual(encryptSnapshot(bytes, key), encryptSnapshot(bytes, key));
  const manager = backupManager({ db, issuer, key, storage: remote });
  try { await assert.rejects(manager.run()); assert.equal(manager.healthy(), false); }
  finally { await manager.close(); db.close(); }
});

function http(port, path, headers = {}, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method, headers }, res => {
      const parts = []; res.on('data', data => parts.push(data));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(parts).toString() }));
    }); req.on('error', reject); req.end(body);
  });
}
test('production edge enforces host/TLS, excludes only healthchecks, and ignores spoofed forwarding for quotas', async t => {
  const running = await serve({ file: join(temporary(t), 'edge.sqlite'), port: 0, issuer, production: true,
    generation: 'one', backup: { key: randomBytes(32) }, storage: storage(), audit: () => {}, limits: { registrationsPerMinute: 1 } });
  try {
    const port = running.server.address().port; const headers = { Host: new URL(issuer).host, 'X-Forwarded-Proto': 'https' };
    assert.equal((await http(port, '/health', { Host: 'healthcheck.railway.app' })).status, 200);
    assert.equal((await http(port, '/api/search?q=x', { Host: 'healthcheck.railway.app' })).status, 400);
    assert.equal((await http(port, '/', { Host: new URL(issuer).host })).status, 400);
    assert.equal((await http(port, '/', { ...headers, Host: 'spoof.test' })).status, 400);
    assert.equal((await http(port, '/', headers)).status, 200);
    for (let i = 0; i < 2; i++) {
      const response = await http(port, '/agent/identity', { ...headers, 'X-Forwarded-For': `192.0.2.${i}`, 'CF-Connecting-IP': `192.0.2.${i}`, 'Content-Type': 'application/json' }, 'POST', '{"type":"anonymous"}');
      assert.equal(response.status, i === 0 ? 200 : 429);
    }
    assert.equal((await http(port, '/health', { Host: 'healthcheck.railway.app' })).status, 200);
  } finally { await running.close(); }
});
