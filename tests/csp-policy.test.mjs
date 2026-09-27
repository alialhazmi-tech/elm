import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { contentSecurityPolicy } from '../lib/security/csp.ts';
import { themeInit, tagManagerInit } from '../lib/security/browser-scripts.ts';
test('editorial scripts require nonce or exact bootstrap hash, public pages preserve ISR, inline handlers blocked',()=>{
 const policy=contentSecurityPolicy(false,'unique-test-nonce');const scripts=policy.split('; ').find(x=>x.startsWith('script-src '));
 assert.ok(scripts.includes("'nonce-unique-test-nonce'"));assert.ok(!scripts.includes('unsafe-inline'));assert.ok(!policy.includes("'unsafe-eval'"));
 // WASM فقط (كاشف الوجوه في المحرر)، والصفحات العامة بلا هذا الإذن.
 assert.ok(scripts.includes("'wasm-unsafe-eval'"));assert.ok(!contentSecurityPolicy(false).includes('wasm-unsafe-eval'));
 for(const script of [themeInit,tagManagerInit])assert.ok(scripts.includes(createHash('sha256').update(script).digest('base64')));
 assert.ok(policy.includes("script-src-attr 'none'"));assert.ok(contentSecurityPolicy(false).includes("script-src 'self' 'unsafe-inline'"));
 assert.ok(contentSecurityPolicy(true,'dev-nonce').includes('unsafe-eval'));
});
