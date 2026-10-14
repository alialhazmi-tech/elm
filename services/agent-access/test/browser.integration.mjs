import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '../src/server.mjs';
import { createOwner, secret } from '../src/store.mjs';
import { JWT_GRANT, CLAIM_GRANT } from '../src/credentials.mjs';
import { fixtureServer } from './fixture.mjs';

const chrome = process.env.CHROME_PATH ?? [
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(path => existsSync(path));
if (!chrome) throw new Error('Install Chrome or set CHROME_PATH to its executable');
const fixture = await fixtureServer();
const service = await serve({ file: ':memory:', port: 0, upstream: fixture.url, audit: () => {} });
const email = 'owner@example.test'; const password = secret();
await createOwner(service.db, email, password);
const base = service.issuer;
const output = process.env.AGENT_EVIDENCE_DIR ? resolve(process.env.AGENT_EVIDENCE_DIR) : null;
if (output) mkdirSync(output, { recursive: true });
let browser;
const post = (path, body, form = false) => fetch(base + path, { method: 'POST',
  headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
  body: form ? new URLSearchParams(body) : JSON.stringify(body) });
try {
  // CI runner is an ephemeral test machine; all rendered content is this local fixture.
  browser = await puppeteer.launch({ executablePath: chrome, headless: true,
    args: process.env.CI ? ['--no-sandbox'] : [] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 800 });
  const posts = [];
  page.on('request', request => { if (request.method() === 'POST') posts.push({ origin: request.headers().origin, referer: request.headers().referer }); });
  const reg = await (await post('/agent/identity', { type: 'anonymous' })).json();
  const before = await (await post('/oauth2/token', { grant_type: JWT_GRANT, assertion: reg.identity_assertion, resource: base + '/api' }, true)).json();
  const claim = await (await post('/agent/identity/claim', { claim_token: reg.claim_token, email })).json();
  await page.goto(base, { waitUntil: 'networkidle0' });
  if (output) await page.screenshot({ path: output + '/home.png', fullPage: true });
  await page.goto(claim.claim_attempt.verification_uri);
  await page.waitForFunction(() => location.hash === '' && document.querySelector('[name=claim_attempt_token]').value.length === 43);
  assert.equal(page.url(), base + '/claim');
  await page.type('[name=email]', email); await page.type('[name=password]', password);
  await page.type('[name=user_code]', claim.claim_attempt.user_code);
  const [approved] = await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  assert.equal(approved.status(), 200);
  assert.match(await page.$eval('body', el => el.textContent), /تم ربط الوكيل/);
  if (output) await page.screenshot({ path: output + '/claim-completed.png', fullPage: true });
  const read = token => fetch(base + '/api/search?q=test', { headers: { Authorization: 'Bearer ' + token } });
  assert.equal((await read(before.access_token)).status, 401);
  const claimedResponse = await post('/oauth2/token', { grant_type: CLAIM_GRANT, claim_token: reg.claim_token, resource: base + '/api' }, true);
  assert.equal(claimedResponse.status, 200);
  const after = await claimedResponse.json();
  const content = await read(after.access_token); assert.equal(content.status, 200);
  assert.equal((await content.json()).items[0].id, 'fixture-1');
  await page.goto(base + '/owner/revoke');
  await page.type('[name=email]', email); await page.type('[name=password]', password);
  await page.type('[name=registration_id]', reg.registration_id);
  const [revoked] = await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  assert.equal(revoked.status(), 200);
  assert.match(await page.$eval('body', el => el.textContent), /تم إلغاء تسجيل الوكيل/);
  if (output) await page.screenshot({ path: output + '/revoked.png', fullPage: true });
  assert.equal((await read(after.access_token)).status, 401);
  assert.equal(posts.length, 2);
  for (const headers of posts) { assert.equal(headers.origin, base); assert.equal(headers.referer, base + '/'); }
  const result = { time: new Date().toISOString(), environment: 'loopback fixture only', browser: await browser.version(),
    checks: { registration: true, browserClaim: true, preClaimTokenInvalidated: true, publicRead: true,
      ownerRevocation: true, revokedTokenDenied: true, csrfOriginPresent: true, verificationURLNotInReferrer: true }, productionCalls: 0 };
  if (output) writeFileSync(output + '/browser-check.json', JSON.stringify(result, null, 2) + '\n');
  console.info(JSON.stringify(result));
} finally { if (browser) await browser.close(); await service.close(); await fixture.close(); }
