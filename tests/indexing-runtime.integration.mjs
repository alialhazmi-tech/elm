import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { request } from 'node:http';
import path from 'node:path';
const socket=createServer(); socket.listen(0,'127.0.0.1'); await once(socket,'listening');
const port=socket.address().port; await new Promise(resolve=>socket.close(resolve));
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.resolve('node_modules/next/dist/bin/next'),'start','-p',String(port)],{
  env:{...process.env,DATABASE_URL:'',NEXT_DIST_DIR:process.env.NEXT_DIST_DIR||'.next-gate'},stdio:['ignore','pipe','pipe']
});
let output=''; server.stdout.on('data',data=>{output+=data});server.stderr.on('data',data=>{output+=data});
try {
let ready=false;
for(let attempt=0;attempt<100;attempt++) {
  try { if((await fetch(origin)).ok) {ready=true;break;} } catch { /* server starting */ }
  await new Promise(resolve=>setTimeout(resolve,100));
}
assert.ok(ready,output);
const results=[];
async function get(path,options={}) {const r=await fetch(origin+path,{redirect:'manual',...options});const html=await r.text();const canonicals=[...html.matchAll(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(x=>x[1]);results.push({path,status:r.status,location:r.headers.get('location'),canonicals});return {r,html,canonicals};}
for(const base of ['/sciences','/series/bel-arqam']) {
 const a=await get(base+'?p=999999');assert.equal(a.r.status,308);assert.ok(!a.r.headers.get('location').includes('999999'));const b=await get(a.r.headers.get('location'));assert.equal(b.r.status,200);
 for(const p of ['1','0','-1','NaN','02','2garbage']) {const a=await get(base+'?p='+p);assert.equal(a.r.status,308);}
 const a2=await get(base+'?p=2');assert.ok([200,308].includes(a2.r.status));
}
const sitemap=await get('/sitemap.xml');assert.equal(sitemap.r.status,200);assert.ok(!sitemap.html.includes('<loc>https://alelm.net/search</loc>'));
const videos=await get('/sitemap-videos.xml');assert.equal(videos.r.status,200);assert.ok(videos.r.headers.get('content-type').includes('application/xml'));
assert.ok(videos.html.includes('http://www.google.com/schemas/sitemap-video/1.1'));
const prototype=await get('/infographic/test');assert.ok(/<meta[^>]*name="robots"[^>]*noindex/.test(prototype.html));
const robots=await get('/robots.txt');assert.ok(robots.html.includes('sitemap-videos.xml'));
const storyPath=new URL([...sitemap.html.matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>x[1]).find(x=>/\/[^/]+\/[^/]+\/[^/]+$/.test(new URL(x).pathname))).pathname;
const article=await get(storyPath);assert.equal(article.r.status,200);assert.equal(article.canonicals.length,1);
const www=await new Promise((resolve,reject)=>{const req=request(origin+storyPath+'?utm_source=x',{headers:{host:'www.alelm.net'}},res=>{res.resume();res.on('end',()=>resolve(res))});req.on('error',reject);req.end()});
assert.equal(www.statusCode,308);assert.equal(www.headers.location,'https://alelm.net'+storyPath+'?utm_source=x');
const alt=await get('/sitemap_index.xml');assert.equal(alt.r.status,308);assert.equal(alt.r.headers.get('location'),'/sitemap.xml');
console.log('PASS: archive bounds, canonical aliases, sitemap exclusions, video XML, robots, article single canonical, www redirect and legacy sitemap.');

} finally { if(server.exitCode===null){server.kill("SIGTERM");await once(server,"exit");} }
