/** Explicit reviewed ownership mapping only; dry-run by default. Never infer identity from display names. */
import { readFile } from 'node:fs/promises';
import pg from 'pg';
const file = process.argv.find(arg => arg.startsWith('--mapping='))?.slice(10);
if (!file) throw new Error('Supply --mapping=reviewed.json with [{storyId,userId}]. Dry-run is the default.');
const mapping = JSON.parse(await readFile(file, 'utf8'));
if (!Array.isArray(mapping) || !mapping.length || mapping.some(row => typeof row.storyId !== 'string' || typeof row.userId !== 'string')) throw new Error('Invalid ownership mapping.');
if (new Set(mapping.map(row => row.storyId)).size !== mapping.length) throw new Error('Duplicate story IDs.');
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error('Direct DATABASE_URL_UNPOOLED required.');
const client = new pg.Client({ connectionString }); await client.connect();
const apply = process.argv.includes('--apply');
try {
  await client.query('begin');
  for (const row of [...mapping].sort((a,b) => a.storyId.localeCompare(b.storyId))) {
    const story = (await client.query('select author_id from stories where id=$1 for update', [row.storyId])).rows[0];
    const user = (await client.query("select id from users where id=$1 and status='active'", [row.userId])).rows[0];
    if (!story || !user || (story.author_id && story.author_id !== row.userId)) throw new Error(`Mapping conflict for ${row.storyId}`);
    if (apply && !story.author_id) {
      await client.query('update stories set author_id=$1,version=version+1 where id=$2', [row.userId,row.storyId]);
      await client.query("insert into audit_log(id,at,actor,action,story_id,detail) values($1,$2,'migration-operator','owner:assign',$3,$4)", [crypto.randomUUID(),new Date().toISOString(),row.storyId,row.userId]);
    }
  }
  await client.query(apply ? 'commit' : 'rollback');
  console.log(`${apply ? 'Applied' : 'Validated dry-run'} ${mapping.length} explicit assignments. Display bylines and URLs unchanged.`);
} catch (error) { await client.query('rollback'); throw error; }
finally { await client.end(); }
