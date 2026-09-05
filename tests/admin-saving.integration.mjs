import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
const source = process.env.TEST_DATABASE_URL;
if (!source || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error('Isolated TEST_DATABASE_URL required');
const name = `alelm_test_admin_saving_${process.pid}`;
const url = new URL(source); url.pathname = `/${name}`;
const admin = new pg.Client({connectionString:source}); await admin.connect();
const directory = `tmp/admin-saving-test-${process.pid}`;
await mkdir(directory,{recursive:true}); let client;
try {
  await admin.query(`create database "${name}"`);
  client = new pg.Client({connectionString:url.href}); await client.connect();
  globalThis.__savingDb = drizzle(client); await migrate(globalThis.__savingDb,{migrationsFolder:'drizzle'});
  await client.query("insert into stories(id,slug,section,title,status) values('article','article','sciences','مادة محفوظة','published'),('draft','draft','sciences','مسودة','draft')");
  await client.query("insert into users(id,username,display_name,password_hash,created_at) values('admin-a','admin-a','مشرف','unused','2026-09-05'),('admin-b','admin-b','محرر','unused','2026-09-05')");
  await build({stdin:{contents:`export {GET as state} from './app/api/me/article-state/route'; export {GET as list, POST as save} from './app/api/me/saved/route'; export {POST as remove} from './app/api/tahrir/account/saved/route';`,resolveDir:process.cwd(),loader:'ts'},outfile:`${directory}/subject.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'isolate',setup(b){
    b.onResolve({filter:/^next\/server$/},()=>({path:'next/server.js',external:true}));
    b.onResolve({filter:/^\.\/auth$/},args=>args.importer.endsWith('/access.ts')?{path:'auth',namespace:'fixture'}:undefined);
    b.onResolve({filter:/^(?:@\/lib\/db|@\/lib\/personalization\/session|@\/lib\/content\/provider)$/},args=>({path:args.path,namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:({
      '@/lib/db':'export function getDb(){return globalThis.__savingDb}',
      '@/lib/personalization/session':'export async function getSessionMemberId(){return globalThis.__savingMember??null} export function privateJson(body,status=200){return Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}})}',
      '@/lib/content/provider':'export const seedContentProvider={getStory:async id=>id==="article"?{id,slug:id,section:"sciences",title:"مادة محفوظة",excerpt:"",eyebrow:"",readingMinutes:1,image:null}:null}',
      auth:'export async function getSession(){return globalThis.__savingSession??null}',
    })[args.path],loader:'js'}));
  }}]});
  const subject=await import(`../${directory}/subject.mjs`);
  const request=(body)=>new Request('https://test.invalid/api/me/saved',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://test.invalid'},body:JSON.stringify(body)});
  const state=async()=>{const r=await subject.state(new Request('https://test.invalid/api/me/article-state?storyId=article'));assert.equal(r.headers.get('cache-control'),'private, no-store');return r.json()};
  const save=(owner,saved=true,storyId='article')=>subject.save(request({expectedMemberId:owner,saved,storyId}));
  assert.equal((await state()).saveOwnerId,null); assert.equal((await save('tahrir:admin-a')).status,401);
  globalThis.__savingSession={userId:'admin-a',sessionVersion:1};
  let data=await state(); assert.equal(data.saveOwnerId,'tahrir:admin-a'); assert.equal(data.signedIn,false,'administrative save access must not impersonate Neon membership');
  assert.equal((await save(data.saveOwnerId)).status,200); assert.equal((await save(data.saveOwnerId)).status,200);
  assert.equal((await state()).saved,true);
  assert.equal((await client.query('select count(*)::int n from member_saved_stories')).rows[0].n,1);
  let list=await (await subject.list(new Request('https://test.invalid/api/me/saved'))).json();assert.equal(list.items.length,1);assert.equal(list.memberId,'tahrir:admin-a');
  assert.equal((await save('tahrir:admin-a',true,'draft')).status,404);
  // Account changes cannot modify the old account's library.
  globalThis.__savingSession={userId:'admin-b',sessionVersion:1};
  assert.equal((await state()).saved,false); assert.equal((await save('tahrir:admin-a',false)).status,409);
  assert.equal((await save('tahrir:admin-b')).status,200);
  // Public-header precedence: a simultaneous member session saves to that member only.
  globalThis.__savingMember='audience'; assert.equal((await state()).saveOwnerId,'audience');
  assert.equal((await save('audience')).status,200);
  assert.equal((await subject.remove(request({storyId:'article',saved:false,expectedMemberId:'tahrir:admin-b'}))).status,200);
  assert.equal((await state()).saved,true,'removing an admin save must retain member save');
  assert.equal((await subject.remove(request({storyId:'article',saved:false,expectedMemberId:'tahrir:admin-a'}))).status,409);
  globalThis.__savingMember=null;
  // Live status and token-version checks apply to every administrative save request.
  await client.query("update users set status='suspended' where id='admin-b'");
  assert.equal((await state()).saveOwnerId,null); assert.equal((await save('tahrir:admin-b')).status,401);
  await client.query("update users set status='active',session_version=2 where id='admin-b'");
  assert.equal((await state()).saveOwnerId,null);
  globalThis.__savingSession={userId:'admin-b',sessionVersion:2};
  await client.query("update users set must_change_password=1 where id='admin-b'");
  data=await state();assert.equal(data.saveOwnerId,null);assert.equal(data.saveLoginHref,'/tahrir/password');assert.equal((await save('tahrir:admin-b')).status,403);
  await client.query("delete from users where id='admin-b'");assert.equal((await state()).saveOwnerId,null);
  console.log('Admin saving passed: guest rejection, administrative save/list, retry deduplication, account isolation, dual-session precedence, independent removal, unpublished content, suspension, revocation, temporary passwords and deleted accounts.');
} finally {await client?.end();await admin.query(`drop database if exists "${name}"`);await admin.end();await rm(directory,{recursive:true,force:true});}
