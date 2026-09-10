import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
const result=await build({entryPoints:['lib/mobile/browse.ts'],bundle:true,platform:'node',format:'esm',write:false,
  plugins:[{name:'published-provider-fixture',setup(build){
    build.onResolve({filter:/^@\/lib\/content\/provider$/},()=>({path:'provider',namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`
      export const KNOWN_SECTIONS=['politics','videos'];
      export const seedContentProvider={getSeries:async slug=>slug==='absat'?{slug}:null};
      function page(slug,raw){
        if(raw==='fail') throw new Error('database unavailable');
        const page=Math.min(2,Math.max(1,parseInt(raw)||1));
        return {items:[{id:slug+'-'+page,slug:'canonical',section:'politics',title:'Published',excerpt:'Summary',eyebrow:'',readingMinutes:2,body:'PRIVATE BODY',image:'/uploads/photo.jpg'}],page,pageCount:2,total:25};
      }
      export const pageBySection=async (slug,raw)=>page(slug,raw);
      export const pageBySeries=async (slug,raw)=>page(slug,raw);
    `}));
  }}]});
const {mobileBrowse}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
test('archives preserve totals, canonical cards and bounded next-page cursor',async()=>{
  for(const [kind,slug] of [['section','politics'],['section','videos'],['series','absat']]){
    const first=await mobileBrowse(kind,slug,'1','https://alelm.net');
    const last=await mobileBrowse(kind,slug,'2','https://alelm.net');
    assert.equal(first.total,25); assert.equal(first.nextPage,2); assert.equal(last.nextPage,null);
    assert.notEqual(first.stories[0].id,last.stories[0].id);
    assert.equal(first.stories[0].href,`/politics/${slug}-1/canonical`);
    assert.ok(first.stories[0].image.startsWith('https://alelm.net/'));
    assert.equal('body' in first.stories[0],false);
  }
});
test('rejects unknown kinds, sections and series instead of serving a different archive',async()=>{
  for(const [kind,slug] of [['admin','politics'],['section','missing'],['series','missing']])
    assert.equal(await mobileBrowse(kind,slug,null,'https://alelm.net'),null);
});
test('retains provider page normalization and surfaces failures',async()=>{
  assert.equal((await mobileBrowse('section','politics','-3','https://alelm.net')).page,1);
  assert.equal((await mobileBrowse('section','politics','999','https://alelm.net')).nextPage,null);
  await assert.rejects(()=>mobileBrowse('section','politics','fail','https://alelm.net'),/database unavailable/);
});
