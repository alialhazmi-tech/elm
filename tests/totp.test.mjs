import test from 'node:test';
import assert from 'node:assert/strict';
import { base32, totp, matchingCounter, sealMfa, openMfa } from '../lib/tahrir/totp.ts';
// SHA-1 vectors from RFC 6238 Appendix B, including times beyond 2038.
test('TOTP matches the published RFC 6238 vectors', async () => {
  const key = base32(new TextEncoder().encode('12345678901234567890'));
  for (const [seconds, expected] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']]) {
    assert.equal(await totp(key, Math.floor(seconds / 30), 8), expected);
  }
  assert.equal(await matchingCounter(key, '287082', 59000), 1);
  assert.equal(await matchingCounter(key, '287082', 180000), null);
  assert.equal(await matchingCounter(key, '28708x', 59000), null);
});
test('MFA encrypted secrets are bound to the account and purpose; tampering fails', async () => {
  const previous = process.env.TAHRIR_MFA_KEY;
  process.env.TAHRIR_MFA_KEY = 'ab'.repeat(32);
  try {
    const sealed = await sealMfa('test-secret', 'secret:alice');
    assert.equal(await openMfa(sealed, 'secret:alice'), 'test-secret');
    await assert.rejects(openMfa(sealed, 'secret:bob'));
    await assert.rejects(openMfa(sealed, 'enroll:alice'));
    const [iv, cipher] = sealed.split('.');
    await assert.rejects(openMfa(`${iv}.${cipher[0] === 'A' ? 'B' : 'A'}${cipher.slice(1)}`, 'secret:alice'));
  } finally { if (previous === undefined) delete process.env.TAHRIR_MFA_KEY; else process.env.TAHRIR_MFA_KEY = previous; }
});
