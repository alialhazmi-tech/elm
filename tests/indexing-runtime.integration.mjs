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
const articleTitle=article.html.match(/<title>(.*?)<\/title>/s)?.[1]??'';
assert.equal((articleTitle.match(/\| العلم/g)??[]).length,1,'Article title should contain exactly one site brand suffix');
// Validate the server-rendered SEO contract, rather than matching component source.
function structuredData(html) {
 return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  .flatMap(([,json]) => { const value=JSON.parse(json); return Array.isArray(value)?value:value['@graph']??[value]; });
}
function breadcrumbs(html, expectedLength) {
 const data=structuredData(html).find(item=>item['@type']==='BreadcrumbList');
 assert.ok(data, 'BreadcrumbList must be rendered in the response');
 assert.equal(data.itemListElement.length,expectedLength);
 assert.deepEqual(data.itemListElement.map(item=>item.position),Array.from({length:expectedLength},(_,i)=>i+1));
 for(const item of data.itemListElement) {
  assert.ok(item.name.trim());
  if(item.item) assert.ok(item.item.startsWith('https://alelm.net/'));
 }
 assert.match(html,/<nav\b[^>]*aria-label="[^"]*مسار[^"]*"/u);
 assert.match(html,/<span\b[^>]*aria-current="page"/u,'The current breadcrumb must be plain text');
}
const home=await get('/');
const heroImage=home.html.match(/<a\b[^>]*class="sh-lead-media"[^>]*>\s*(<img\b[^>]*>)/)?.[1];
assert.ok(heroImage,'The homepage hero is rendered as an image');
assert.match(heroImage,/fetchpriority="high"/i);
assert.match(heroImage,/loading="eager"/i);
const fontPreloads=[...home.html.matchAll(/<link\b[^>]*>/gi)].filter(([tag]) => /\brel="preload"/i.test(tag) && /\bas="font"/i.test(tag));
assert.ok(fontPreloads.length > 0, 'Fonts used in the initial viewport should be discovered before CSS');
assert.equal(new Set(fontPreloads.map(([tag])=>tag.match(/href="([^"]+)"/)?.[1])).size,fontPreloads.length,'Font preloads must not duplicate requests');
assert.ok(structuredData(home.html).some(item=>item['@type']==='WebSite'));
assert.ok(structuredData(home.html).some(item=>item['@type']==='NewsMediaOrganization'));
const articleData=structuredData(article.html).find(item=>item['@type']==='NewsArticle');
assert.ok(articleData);
assert.equal(articleData.headline.trim().length>0,true);
assert.ok(articleData.mainEntityOfPage,'NewsArticle identifies its canonical page');
breadcrumbs(article.html,3);
for(const path of ['/sciences','/series/bel-arqam']) {
 const archive=await get(path); assert.equal(archive.r.status,200);
 breadcrumbs(archive.html,path.startsWith('/series/')?3:2);
 const title=archive.html.match(/<title>(.*?)<\/title>/s)?.[1]??'';
 assert.equal((title.match(/\| العلم/g)??[]).length,1,'Site title suffix appears once');
 const description=archive.html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/)?.[1];
 assert.ok(description?.trim());
}
for(const [path,count] of [['/contact',2],['/privacy-policy',1]]) {
 const page=await get(path);assert.equal(page.r.status,200);
 assert.ok((page.html.match(/<!--email_off-->/g)??[]).length>=count,'Public email links opt out of Cloudflare rewriting');
 assert.ok((page.html.match(/href="mailto:/g)??[]).length>=count,'Email links work in the server-rendered response');
 assert.doesNotMatch(page.html,/href="[^"]*\/cdn-cgi\/l\/email-protection/u);
}
const www=await new Promise((resolve,reject)=>{const req=request(origin+storyPath+'?utm_source=x',{headers:{host:'www.alelm.net'}},res=>{res.resume();res.on('end',()=>resolve(res))});req.on('error',reject);req.end()});
assert.equal(www.statusCode,308);assert.equal(www.headers.location,'https://alelm.net'+storyPath+'?utm_source=x');
const alt=await get('/sitemap_index.xml');assert.equal(alt.r.status,308);assert.equal(alt.r.headers.get('location'),'/sitemap.xml');
console.log('PASS: archive bounds, canonical aliases, sitemap exclusions, video XML, robots, rendered schema/breadcrumbs/metadata, article single canonical, www redirect and legacy sitemap.');

} finally { if(server.exitCode===null){server.kill("SIGTERM");await once(server,"exit");} }
