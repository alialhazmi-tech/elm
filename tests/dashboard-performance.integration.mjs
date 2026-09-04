import assert from 'node:assert/strict';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
const source=process.env.TEST_DATABASE_URL;
if(!source || !/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error('Isolated TEST_DATABASE_URL named alelm_test* required');
const database=`alelm_test_dashboard_${process.pid}`;
const url=new URL(source);url.pathname=`/${database}`;
const admin=new pg.Client({connectionString:source});await admin.connect();
const directory=`tmp/dashboard-test-${process.pid}`;await mkdir(directory,{recursive:true});
let client;
try {
 await admin.query(`create database "${database}"`);
 client=new pg.Client({connectionString:url.href});await client.connect();
 let queryCount=0;
 globalThis.__dashboardDb=drizzle(client,{logger:{logQuery(){queryCount++}}});
 await migrate(globalThis.__dashboardDb,{migrationsFolder:'drizzle'});
 await client.query(`insert into stories(id,slug,section,title,status,series_slug,body,published_at,updated_at,format)
 select 'fixture-'||n,'fixture-'||n,'health','مادة للاختبار '||n,
 case when n%100=0 then 'archived' when n%101=0 then 'review' else 'published' end,
 case when n%2=0 then 'absat' else 'aghrab' end, repeat('محتوى القراءة ',200),
 to_char('2026-01-01'::timestamp+(n||' minutes')::interval,'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
 case when n%3=0 then to_char('2026-01-01'::timestamp+(n||' minutes')::interval,'YYYY-MM-DD"T"HH24:MI:SS"Z"') else null end,
 case when n%20=0 then 'jakalelm' else 'news' end from generate_series(1,30000) n`);
 await client.query(`insert into media(id,url,filename,mime,bytes,rights_cleared,uploaded_by,created_at)
 select 'media-'||n,'/fixture/'||n,'fixture-'||n,'image/jpeg',1000,n%2,'fixture',
 to_char('2026-01-01'::timestamp+(n||' minutes')::interval,'YYYY-MM-DD"T"HH24:MI:SS"Z"') from generate_series(1,30000) n`);
 await client.query('analyze stories');await client.query('analyze media');
 const migration=await readFile('drizzle/0006_dashboard_performance.sql','utf8');
 const indexes=[...migration.matchAll(/CREATE INDEX "([^"]+)"/g)].map(match=>match[1]);
 for(const index of indexes) await client.query(`drop index "${index}"`);
 const queries={
  all:`select id,title from stories where status <> 'archived' order by coalesce(updated_at,published_at) desc,id desc limit 25`,
  published:`select id,title from stories where status='published' order by coalesce(updated_at,published_at) desc,id desc limit 25`,
  format:`select id,title from stories where format='jakalelm' and status <> 'archived' order by coalesce(updated_at,published_at) desc,id desc limit 25`,
  media:`select id,filename,url from media order by created_at desc limit 6`,
  clearedMedia:`select id,filename,url from media where rights_cleared=1 order by created_at desc limit 6`,
 };
 const measure=async q=>{
   let result;const times=[];
   for(let i=0;i<3;i++){result=(await client.query('explain (analyze,buffers,format json) '+q)).rows[0]['QUERY PLAN'][0];times.push(result['Execution Time']);}
   return {ms:times.sort((a,b)=>a-b)[1],blocks:result.Plan['Shared Hit Blocks'],plan:JSON.stringify(result.Plan)};
 };
 const before={},rows={};
 for(const [name,q] of Object.entries(queries)){before[name]=await measure(q);rows[name]=(await client.query(q)).rows;}
 await client.query(migration);
 for(const [name,q] of Object.entries(queries)){
  const after=await measure(q);assert.deepEqual((await client.query(q)).rows,rows[name]);
  assert.match(after.plan,/Index Scan/); assert.ok(after.blocks<before[name].blocks,`${name}: fewer blocks read`);
  console.log(JSON.stringify({query:name,beforeMs:before[name].ms,afterMs:after.ms,beforeBlocks:before[name].blocks,afterBlocks:after.blocks}));
 }
 await build({stdin:{contents:`export { listPage,listPageForReview,bodiesFor,countPage,listLatestByStatus } from './lib/tahrir/service';`,resolveDir:process.cwd(),loader:'ts'},outfile:`${directory}/subject.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'db',setup(b){
 b.onResolve({filter:/^@\/lib\/db$/},()=>({path:'db',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export function getDb(){return globalThis.__dashboardDb}',loader:'js'}));
 b.onResolve({filter:/^next\/(headers|server)$/},args=>({path:args.path+'.js',external:true}));
 }}]});
 const subject=await import(`../${directory}/subject.mjs`);
 for(const [status,filters] of [[undefined,{}],['published',{}],['review',{}],['archived',{}],[undefined,{q:'299',seriesSlug:'absat'}],[undefined,{q:'%_'}]]){
  queryCount=0;const oldRows=await subject.listPage(status,1,25,filters);const bodies=await subject.bodiesFor(oldRows.map(row=>row.id));const previousQueries=queryCount;
  queryCount=0;const nextRows=await subject.listPageForReview(status,1,25,filters);assert.equal(queryCount,1);
  assert.deepEqual(nextRows.map(({body,...row})=>{assert.equal(typeof body,"string");return row;}),oldRows);
  for(const row of nextRows) assert.equal(row.body,bodies.get(row.id).body);
  if(oldRows.length) assert.equal(previousQueries,2);
 }
 // Same timestamps remain stable across pages; guard bodies never become an unbounded corpus.
 const first=await subject.listPageForReview(undefined,1,25),second=await subject.listPageForReview(undefined,2,25);
 assert.equal(first.length,25);assert.equal(second.length,25);assert.equal(new Set([...first,...second].map(r=>r.id)).size,50);
 console.log('Dashboard query parity, filters, guard content, stable pagination and one-trip list loading passed. Synthetic fixture: 30,000 stories and 30,000 media.');
} finally {
 await client?.end();await admin.query(`drop database if exists "${database}"`);await admin.end();await rm(directory,{recursive:true,force:true});delete globalThis.__dashboardDb;
}
