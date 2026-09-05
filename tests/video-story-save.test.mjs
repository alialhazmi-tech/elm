import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

test('manual save and autosave pass normalized X and YouTube links through the real story API', async () => {
  const saved = [];
  globalThis.__videoSave = input => { saved.push(input); return { id: input.id, version: 1 }; };
  try {
    const output = await build({entryPoints:['app/api/tahrir/story/route.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,
      plugins:[{name:'isolate-writes',setup(b){
        const fixtures={
          '@/lib/tahrir/access':'export const requireActor=async()=>({ok:true,actor:{can:()=>false}});export const canEditStory=()=>true;',
          '@/lib/tahrir/service':'export const getStory=async()=>null;export const deleteDraft=async()=>{};export const saveDraft=async input=>globalThis.__videoSave(input);',
        };
        b.onResolve({filter:/^@\/lib\/tahrir\/(access|service)$/},args=>({path:args.path,namespace:'fixture'}));
        b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:fixtures[args.path],loader:'js'}));
      }}]});
    const compiled={exports:{}};
    new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
    const post=(videoUrl,autosave=false)=>compiled.exports.POST(new Request('https://example.test/api/tahrir/story',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'مادة مرئية',body:'متن المادة',format:'videos',videoUrl,autosave}),
    }));
    for (const autosave of [false,true]) {
      assert.equal((await post('https://twitter.com/TwitterDev/status/560070183650213889/video/1?s=20',autosave)).status,200);
      assert.equal(saved.at(-1).videoUrl,'https://x.com/i/status/560070183650213889');
      assert.equal(saved.at(-1).format,'videos');
    }
    assert.equal((await post('https://youtu.be/vEaijy5naDA?list=other')).status,200);
    assert.equal(saved.at(-1).videoUrl,'https://www.youtube.com/watch?v=vEaijy5naDA');
    for (const url of ['', 'https://x.com/TwitterDev', 'https://x.com.evil.test/u/status/123']) {
      const response=await post(url);assert.equal(response.status,400);assert.match((await response.json()).error,/تغريدة/);
    }
    assert.equal(saved.length,3,'invalid video links must not reach the persistence layer');
  } finally { delete globalThis.__videoSave; }
});
