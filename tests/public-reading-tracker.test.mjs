import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { readingInput, readingOrigin } from '../lib/personalization/reading-input.ts';

test('public reading input rejects malformed progress and bounds cumulative time', () => {
  const valid={storyId:'263004',sessionId:crypto.randomUUID(),activeMs:1200,progress:50};
  assert.deepEqual(readingInput(valid),valid);
  for(const patch of [{activeMs:NaN},{activeMs:-1},{progress:101},{progress:'50'},{sessionId:'spoof'},{storyId:'../private'}]) assert.equal(readingInput({...valid,...patch}),null);
  assert.equal(readingInput({...valid,activeMs:9e8}).activeMs,7200000);
});

test('reader measures only visible article time, pauses in background and resets per article', async () => {
  const output=await build({entryPoints:['app/_components/public-reading-tracker.tsx'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'react-effect',setup(b){b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export function useEffect(fn){globalThis.__readingEffect=fn}',loader:'js'}));}}]});
  const {PublicReadingTracker}=await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
  const originals=Object.fromEntries(['window','document','navigator','fetch','clearInterval'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const now=Date.now; let time=100000; Date.now=()=>time;
  const events=new Map(), posts=[]; let tick;
  const target={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
  let box={top:1000,bottom:4000,height:3000};
  Object.defineProperty(globalThis,'window',{configurable:true,value:{...target,innerHeight:800,setInterval:fn=>{tick=fn;return 1}}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{...target,visibilityState:'visible',hasFocus:()=>true,querySelector:()=>({getBoundingClientRect:()=>box})}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{doNotTrack:'0'}});
  globalThis.clearInterval=()=>{};
  globalThis.fetch=async (_url,options)=>{
    if (!options.body) return {ok:true,json:async()=>({liked:false,closingAnswer:null,counts:[0,0]})};
    posts.push({...JSON.parse(options.body),keepalive:options.keepalive});return {ok:true,json:async()=>({accepted:true})};
  };
  const advance=async n=>{for(let i=0;i<n;i++){time+=2000;tick();await new Promise(resolve=>setImmediate(resolve));}};
  try {
    PublicReadingTracker({storyId:'first'}); let cleanup=globalThis.__readingEffect();
    assert.equal(posts.length,0,'wait for browser identity before the first reading write');
    await new Promise(resolve=>setImmediate(resolve));
    await advance(8); assert.equal(posts.at(-1).activeMs,0,'above-body time is excluded');
    box={top:-1100,bottom:1900,height:3000}; await advance(8);
    assert.equal(posts.at(-1).activeMs,16000); assert.equal(posts.at(-1).progress,50);
    document.visibilityState='hidden'; events.get('visibilitychange')(); const before=posts.at(-1).activeMs;
    await advance(16); assert.equal(posts.at(-1).activeMs,before);
    cleanup(); assert.equal(posts.at(-1).keepalive,true);
    const firstSession=posts[0].sessionId;
    document.visibilityState='visible'; PublicReadingTracker({storyId:'second'}); cleanup=globalThis.__readingEffect();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(posts.at(-1).storyId,'second'); assert.equal(posts.at(-1).activeMs,0); assert.equal(posts.at(-1).progress,0); assert.notEqual(posts.at(-1).sessionId,firstSession);
    cleanup(); const count=posts.length;
    navigator.doNotTrack='1'; PublicReadingTracker({storyId:'private'}); assert.equal(globalThis.__readingEffect(),undefined); assert.equal(posts.length,count);
  } finally {
    Date.now=now;
    for(const [key,descriptor] of Object.entries(originals)) {if(descriptor) Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
    delete globalThis.__readingEffect;
  }
});


test('reading origins accept the public Railway site behind internal HTTP and reject foreign origins', () => {
  const request=(origin,extra={})=>new Request('http://localhost:3000/api/content/reading',{headers:{Origin:origin,...extra}});
  assert.equal(readingOrigin(request('https://alelm.net')),'https://alelm.net');
  assert.equal(readingOrigin(request('https://elm-production-ea24.up.railway.app')),'https://elm-production-ea24.up.railway.app');
  for(const origin of ['https://evil.invalid','https://alelm.net.evil.invalid','http://alelm.net','null','https://alelm.net/path']) {
    assert.equal(readingOrigin(request(origin,{'x-forwarded-host':'evil.invalid','x-forwarded-proto':'https'})),null);
  }
  assert.equal(readingOrigin(request('https://alelm.net',{'sec-fetch-site':'cross-site'})),null);
  assert.equal(readingOrigin(request('http://localhost:3000')),'http://localhost:3000');
});
