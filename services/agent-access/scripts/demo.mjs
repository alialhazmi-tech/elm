import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '../src/server.mjs';
import { createOwner, secret } from '../src/store.mjs';
import { fixtureServer } from '../test/fixture.mjs';

process.umask(0o077);
const directory = mkdtempSync(join(tmpdir(), 'alelm-agent-preview-'));
const fixture = await fixtureServer();
const service = await serve({ file: join(directory, 'agent.sqlite'), port: Number(process.env.AGENT_PORT ?? 4318), upstream: fixture.url });
const password = secret();
await createOwner(service.db, 'owner@example.test', password);
const accountFile = join(directory, 'test-account.txt');
writeFileSync(accountFile, `Isolated local test account only\nEmail: owner@example.test\nPassword: ${password}\n`, { mode: 0o600 });
console.info(`Preview: ${service.issuer}\nPrivate test account file: ${accountFile}\nFixture content only; no production network or database access.`);
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => {
  await service.close(); await fixture.close(); process.exit(0);
});
