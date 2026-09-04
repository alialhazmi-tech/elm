import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
const source = process.env.TEST_DATABASE_URL;
if (!source || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error('Isolated TEST_DATABASE_URL named alelm_test* required');
const name = `alelm_test_readings_${process.pid}`;
const url = new URL(source); url.pathname = `/${name}`;
const admin = new pg.Client({connectionString:source}); await admin.connect();
const directory = `tmp/readings-test-${process.pid}`;
await mkdir(directory,{recursive:true});
let client;
try {
  await admin.query(`create database "${name}"`);
  client = new pg.Client({connectionString:url.href}); await client.connect();
  globalThis.__readingDb = drizzle(client);
  await migrate(globalThis.__readingDb,{migrationsFolder:'drizzle'});
  await build({stdin:{contents:`export { POST } from './app/api/content/reading/route'; export { GET } from './app/api/content/insights/route'; export { storyInsights } from './lib/personalization/insights';`,resolveDir:process.cwd(),loader:'ts'},outfile:`${directory}/subject.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'isolate',setup(b){
    b.onResolve({filter:/^(?:@\/lib\/db|next\/headers|@\/lib\/personalization\/session|@\/lib\/content\/provider)$/},args=>({path:args.path,namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:({
      '@/lib/db':'export function getDb(){return globalThis.__readingDb}',
      'next/headers':'export async function cookies(){return {get:()=>globalThis.__readingCookie?{value:globalThis.__readingCookie}:undefined}}',
      '@/lib/personalization/session':'export async function getSessionMemberId(){return globalThis.__readingMember??null} export function privateJson(body,status=200){return Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}})}',
      '@/lib/content/provider':'export const seedContentProvider={getStory:async id=>id==="article"?{id}:null}',
    })[args.path],loader:'js'}));
  }}]});
  const subject = await import(`../${directory}/subject.mjs`);
  const sessionId=crypto.randomUUID();
  const send = (patch={},headers={}) => subject.POST(new Request('https://test.invalid/api/content/reading',{method:'POST',headers:{Origin:'https://test.invalid','Content-Type':'application/json',...headers},body:JSON.stringify({storyId:'article',sessionId,activeMs:0,progress:0,...patch})}));
  assert.equal((await send({}, {Origin:'https://evil.invalid'})).status,403);
  assert.equal((await send({sessionId:'invalid'})).status,400);
  assert.equal((await send({storyId:'missing'})).status,404);
  let response=await subject.POST(new Request('http://localhost:3000/api/content/reading',{method:'POST',headers:{Origin:'https://alelm.net','Content-Type':'application/json'},body:JSON.stringify({storyId:'article',sessionId,activeMs:0,progress:0})})); assert.equal(response.status,200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax;.*Secure/);
  globalThis.__readingCookie=response.headers.get('set-cookie').split(';')[0].split('=')[1];
  await client.query("update story_reading_sessions set created_at=$1",[new Date(Date.now()-300000).toISOString()]);
  for(const activeMs of [120000,120000,60000]) assert.equal((await send({activeMs,progress:90})).status,200);
  const row=(await client.query('select active_ms,max_progress from story_reading_sessions')).rows[0];
  assert.deepEqual(row,{active_ms:120000,max_progress:90});
  await send({sessionId:crypto.randomUUID()});
  let stats=await subject.storyInsights('article');
  assert.equal(stats.readers,1); assert.equal(stats.avgMinutes,2); assert.equal(stats.completion,100);
  assert.deepEqual(stats.timeBuckets,[0,100,0,0]);
  await client.query("insert into member_story_stats(member_id,story_id,liked,ai_tools,last_visit_at,updated_at) values('member','article',1,'[]',$1,$1)",[new Date().toISOString()]);
  globalThis.__readingMember='member'; await send({activeMs:120000,progress:90});
  stats=await subject.storyInsights('article'); assert.equal(stats.engagement,100);
  globalThis.__readingMember=null;
  for(let i=0;i<19;i++) { globalThis.__readingCookie=crypto.randomUUID(); assert.equal((await send({sessionId:crypto.randomUUID(),progress:i<9?90:25})).status,200); }
  stats=await subject.storyInsights('article');
  assert.equal(stats.readers,20); assert.equal(stats.completion,50); assert.equal(stats.engagement,5); assert.equal(stats.reach.intro,100);
  await client.query("insert into member_profiles(auth_user_id,personalization_enabled,created_at,updated_at) values('opt-out',0,$1,$1)",[new Date().toISOString()]);
  globalThis.__readingMember='opt-out'; response=await send(); assert.deepEqual(await response.json(),{accepted:false});
  assert.equal((await subject.storyInsights('article')).readers,20);
  await client.query('drop table story_reading_sessions');
  response=await subject.GET(new Request('https://test.invalid/api/content/insights?storyId=article'));
  assert.equal(response.status,503); assert.equal(response.headers.get('cache-control'),'no-store');
  console.log('Public readings: anonymous collection, validation, secure cookie, duplicate/out-of-order pulses, visitor deduplication, real aggregates, opt-out and unavailable storage passed.');
} finally {
  await client?.end(); await admin.query(`drop database if exists "${name}"`); await admin.end(); await rm(directory,{recursive:true,force:true});
}
