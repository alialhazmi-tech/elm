/** Rehearse dump/restore on the isolated integration database only; never a production URL. */
import pg from 'pg';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const source = process.env.TEST_DATABASE_URL;
if (!source || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error('Isolated alelm_test* TEST_DATABASE_URL required.');
const url = new URL(source);
const destination = `alelm_test_restore_${process.pid}`;
const client = new pg.Client({ connectionString: source });
await client.connect();
const directory = await mkdtemp(join(tmpdir(), 'alelm-restore-'));
const dump = join(directory, 'snapshot.dump');
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: url.pathname.slice(1) };
let restored;
try {
  await chmod(directory, 0o700);
  execFileSync('pg_dump', ['-Fc', '--no-owner', '--no-acl', '-f', dump], { env, stdio: ['ignore','ignore','pipe'] });
  await client.query(`create database ${destination}`);
  execFileSync('pg_restore', ['--no-owner', '--no-acl', '--exit-on-error', '-d', destination, dump], { env, stdio: ['ignore','ignore','pipe'] });
  url.pathname = destination;
  restored = new pg.Client({ connectionString: url.toString() }); await restored.connect();
  const tables = (await client.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
  for (const { tablename } of tables) {
    if (!/^[a-z_]+$/.test(tablename)) throw new Error('Unexpected table name');
    const query = `select md5(coalesce(string_agg(row_to_json(t)::text, ',' order by row_to_json(t)::text),'')) as digest from ${tablename} t`;
    const [before, after] = await Promise.all([client.query(query), restored.query(query)]);
    if (before.rows[0].digest !== after.rows[0].digest) throw new Error(`Restore mismatch: ${tablename}`);
  }
  console.log(`Isolated restore rehearsal passed: ${tables.length} tables match.`);
} finally {
  if (restored) await restored.end();
  await client.query(`drop database if exists ${destination}`);
  await client.end();
  await rm(directory, { recursive: true, force: true });
}
