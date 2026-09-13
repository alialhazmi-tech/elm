import assert from 'node:assert/strict';
import test from 'node:test';
import { staffPasswordError, generateStaffTemporaryPassword } from '../lib/tahrir/password-policy.ts';
import { hashPassword, verifyPassword } from '../lib/tahrir/crypto.ts';
test('staff passwords require 15 characters without forced case/digit/symbol composition',()=>{
 assert.ok(staffPasswordError('short-password'));assert.equal(staffPasswordError('long unique words chosen freely'),null);
 assert.equal(staffPasswordError('هذه عبارة مرور عربية فريدة'),null);assert.equal(staffPasswordError('Ab9 '.repeat(128)),null);assert.ok(staffPasswordError('a'.repeat(513)));
 assert.ok(staffPasswordError('😀'.repeat(8)),'Unicode code points, not UTF16 units');
});
test('common complete values rejected without substring bans or secret normalization',async()=>{
 for(const value of ['passwordpassword','PASSWORDPASSWORD','  passwordpassword  ','１２３４５６７８９０１２３４５',' '.repeat(20)])assert.ok(staffPasswordError(value));
 const phrase='my password is a unique quiet garden';assert.equal(staffPasswordError(phrase),null);
 const chosen='  A distinct phrase with spaces  ';const hash=await hashPassword(chosen,1000);assert.equal(await verifyPassword(chosen,hash),true);assert.equal(await verifyPassword(chosen.trim(),hash),false);
});

test('temporary staff passwords satisfy the shared policy', () => {
 const values = new Set();
 for (let i = 0; i < 100; i++) {
  const value = generateStaffTemporaryPassword();
  assert.equal(value.length, 20);
  assert.equal(staffPasswordError(value), null);
  values.add(value);
 }
 assert.equal(values.size, 100);
});
