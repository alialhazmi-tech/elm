import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
const source = process.env.TEST_DATABASE_URL;
if (!source || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error('Isolated TEST_DATABASE_URL named alelm_test* required');
const name = `alelm_test_interactions_${process.pid}`;
const url = new URL(source); url.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: source }); await admin.connect();
const directory = `tmp/interactions-test-${process.pid}`;
await mkdir(directory, { recursive: true });
let client;
try {
  await admin.query(`create database "${name}"`);
  client = new pg.Client({ connectionString: url.href }); await client.connect();
  globalThis.__interactionDb = drizzle(client);
  await migrate(globalThis.__interactionDb, { migrationsFolder: 'drizzle' });
  await build({ stdin: { contents: `export { POST, GET } from './app/api/content/interactions/route'; export { storyInsights } from './lib/personalization/insights'; export { recordMemberEvents } from './lib/personalization/events';`, resolveDir: process.cwd(), loader: 'ts' }, outfile: `${directory}/subject.mjs`, bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'isolate', setup(b) {
    b.onResolve({ filter: /^(?:@\/lib\/db|next\/headers|@\/lib\/personalization\/session|@\/lib\/content\/provider|\.\/interests|\.\/classify)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: ({
      '@/lib/db': 'export function getDb(){return globalThis.__interactionDb}',
      'next/headers': 'export async function cookies(){return {get:()=>globalThis.__interactionCookie?{value:globalThis.__interactionCookie}:undefined}}',
      '@/lib/personalization/session': 'export async function getSessionMemberId(){return globalThis.__interactionMember??null} export function privateJson(body,status=200){return Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}})}',
      '@/lib/content/provider': 'export const seedContentProvider={getStory:async id=>id==="article"?{id}:null}',
      './interests': 'export async function applyStorySignal() {}',
      './classify': 'export async function ensureStoryTopics() {}',
    })[args.path], loader: 'js' }));
  } }] });
  const subject = await import(`../${directory}/subject.mjs`);
  const send = (body, headers = {}) => subject.POST(new Request('https://test.invalid/api/content/interactions', { method: 'POST', headers: { Origin: 'https://test.invalid', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ storyId: 'article', ...body }) }));
  const get = () => subject.GET(new Request('https://test.invalid/api/content/interactions?storyId=article'));
  let response = await get(); assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax;.*Secure/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  globalThis.__interactionCookie = response.headers.get('set-cookie').split(';')[0].split('=')[1];
  assert.deepEqual(await response.json(), { liked: false, closingAnswer: null, counts: [0, 0] });
  assert.equal((await send({ answer: 0 }, { Origin: 'https://evil.invalid' })).status, 403);
  for (const bad of [{ answer: 2 }, { answer: '0' }, { liked: 'true' }, { liked: true, answer: 0 }, { storyId: '../../bad', answer: 0 }]) assert.equal((await send(bad)).status, 400);
  assert.equal((await send({ storyId: 'missing', answer: 0 })).status, 404);
  assert.equal((await send({ answer: 0, filler: 'x'.repeat(1200) })).status, 413);
  assert.equal((await send({ liked: true }, { 'Content-Type': 'text/plain' })).status, 415);
  // Parallel retries and different actions preserve exactly one answer and one like.
  const responses = await Promise.all([send({ answer: 0 }), send({ liked: true }), send({ answer: 0 }), send({ liked: true })]);
  for (const r of responses) assert.equal(r.status, 200);
  assert.deepEqual(await (await get()).json(), { liked: true, closingAnswer: 0, counts: [1, 0] });
  let stats = await subject.storyInsights('article');
  assert.equal(stats.likes, 1); assert.equal(stats.answers, 1); assert.equal(stats.daily.reduce((a,b)=>a+b,0), 2);
  response = await send({ answer: 1 }); assert.deepEqual((await response.json()).counts, [0, 1]);
  await send({ liked: false }); stats = await subject.storyInsights('article');
  assert.equal(stats.likes, 0); assert.equal(stats.answers, 1);
  assert.equal(stats.daily.reduce((a,b)=>a+b,0), 1);
  // Readers with no interaction stay in the denominator, and like + answer count once.
  const now = new Date().toISOString();
  for (let i = 0; i < 20; i++) await client.query('insert into story_reading_sessions(visitor_id,story_id,session_id,created_at,updated_at) values($1,\'article\',$2,$3,$3)', [i === 0 ? globalThis.__interactionCookie : crypto.randomUUID(), crypto.randomUUID(), now]);
  stats = await subject.storyInsights('article'); assert.equal(stats.readers, 20); assert.equal(stats.engagement, 5);
  await send({ liked: true }); assert.equal((await subject.storyInsights('article')).engagement, 5);
  // A different visitor can answer independently.
  globalThis.__interactionCookie = crypto.randomUUID();
  await send({ answer: 1 }); assert.deepEqual((await (await get()).json()).counts, [0, 2]);
  // Members retain their account likes and can amend a single closing answer.
  globalThis.__interactionMember = 'member';
  for (const body of [{ answer: 0 }, { answer: 1 }, { answer: 1 }, { liked: true }]) assert.equal((await send(body)).status, 200);
  assert.deepEqual(await (await get()).json(), { liked: true, closingAnswer: 1, counts: [0, 3] });
  assert.equal((await client.query("select count(*)::int n from member_likes where member_id='member'")).rows[0].n, 1);
  await Promise.all([subject.recordMemberEvents('member', [{ type: 'reading_progress', storyId: 'article', value: 90, durationMs: 15000 }]), send({ answer: 0 }), send({ liked: false })]);
  assert.deepEqual(await (await get()).json(), { liked: false, closingAnswer: 0, counts: [1, 2] });
  // Opting out of inferred personalization still permits explicit answers.
  await client.query("insert into member_profiles(auth_user_id,personalization_enabled,created_at,updated_at) values('member',0,$1,$1)", [now]);
  assert.equal((await send({ answer: 1 })).status, 200);
  globalThis.__interactionMember = null;
  for (let i = 0; i < 31; i++) response = await send({ answer: 0 });
  assert.equal(response.status, 429);
  globalThis.__interactionCookie = crypto.randomUUID();
  await client.query('drop table visitor_story_interactions');
  assert.equal((await send({ answer: 0 })).status, 503);
  assert.equal((await get()).status, 503);
  console.log('Public interactions passed: guest/member persistence, secure identity, strict validation, origin, duplicates, concurrent like/answer/reading, amended votes, unlike, counts, daily series, denominator, privacy opt-out, rate limit and storage failure.');
} finally {
  await client?.end(); await admin.query(`drop database if exists "${name}"`); await admin.end(); await rm(directory, { recursive: true, force: true });
}
