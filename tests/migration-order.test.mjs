import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('migration journal timestamps increase so staged installs cannot skip a migration', async () => {
  const { entries } = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url),'utf8'));
  for (let i=1;i<entries.length;i++) assert.ok(entries[i].when>entries[i-1].when, `${entries[i].tag} must run after ${entries[i-1].tag}`);
});
