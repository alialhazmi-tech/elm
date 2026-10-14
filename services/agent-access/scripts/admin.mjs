import { resolve } from 'node:path';
import { createOwner, openStore, revokeRegistration } from '../src/store.mjs';

process.umask(0o077);
const [command, identity] = process.argv.slice(2);
if (!['create-owner', 'revoke'].includes(command) || !identity) {
  throw new Error('Usage: npm run admin -- create-owner EMAIL (password via stdin), or npm run admin -- revoke REGISTRATION_ID');
}
const db = openStore(resolve(process.env.AGENT_DATA_FILE ?? 'data/agent-access.sqlite'));
try {
  if (command === 'create-owner') {
    if (process.stdin.isTTY) throw new Error('Supply the password through stdin from a password manager; never via an argument');
    let password = '';
    for await (const chunk of process.stdin) {
      password += chunk;
      if (password.length > 258) throw new Error('Password too long');
    }
    await createOwner(db, identity, password.replace(/\r?\n$/, ''));
    console.info('Independent test-owner account created');
  } else {
    const changed = revokeRegistration(db, identity);
    console.info(changed ? 'Registration revoked; all its credentials are disabled' : 'No active matching registration');
  }
} finally { db.close(); }
