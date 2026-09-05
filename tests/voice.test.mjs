import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('tmp',{recursive:true});
const dir=await mkdtemp(`${process.cwd()}/tmp/voice-test-`);
await build({entryPoints:['lib/voice/humain.ts'],outfile:`${dir}/voice.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'socket',setup(b){
  b.onResolve({filter:/^socket.io-client$/},()=>({path:'socket',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const io=(...args)=>globalThis.__voiceSocket(...args)'}));
}}]});
const voice=await import(`${dir}/voice.mjs`);
const config={key:'test-secret',origin:'https://api.voice.humain.com',path:'/socket.io',voice:'test-voice',model:'nebula'};

test('audio cache changes with text and voice, WAV sizes are correct, chunks do not drop words',()=>{
  assert.notEqual(voice.audioKey('موجز',config),voice.audioKey('تحديث',config));
  assert.notEqual(voice.audioKey('موجز',config),voice.audioKey('موجز',{...config,voice:'other'}));
  assert.equal(voice.audioKey('موجز',config),voice.audioKey('موجز',{...config,key:'rotated'}));
  const text=Array(160).fill('العلم').join(' '),chunks=voice.speechChunks(text);
  assert.equal(chunks.join(' '),text);assert.ok(chunks.every(x=>Array.from(x).length<=480));
  assert.throws(()=>voice.speechChunks('!'));assert.throws(()=>voice.pcmToWav(new Uint8Array(3)));
  const wav=voice.pcmToWav(new Uint8Array([1,0,2,0]));
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),24000);
  assert.equal(wav.readUInt32LE(40),4);assert.equal(wav.length,48);
});

test('synthesis waits for final matching frame and closes sockets on success, cancellation, or partial failure',async()=>{
  let socket, mode='success', closed=0;
  globalThis.__voiceSocket=(_url,options)=>{
    assert.equal(options.reconnection,false);assert.equal(options.extraHeaders['x-api-key'],'test-secret');
    socket=new EventEmitter();socket.connect=()=>queueMicrotask(()=>socket.emit('connect'));
    socket.disconnect=()=>closed++;
    socket.on('tts',({id})=>queueMicrotask(()=>{
      const frame=(last,data)=>Buffer.concat([Buffer.from(id.replaceAll('-',''),'hex'),Buffer.from([last]),Buffer.from(data)]);
      socket.emit('tts_audio',Buffer.alloc(19)); // another request must be ignored
      socket.emit('tts_audio',frame(0,[1,0]));
      if(mode==='success')socket.emit('tts_audio',frame(1,[2,0]));
      else if(mode==='failure')socket.emit('error',{id,code:'TTS_DEADLINE_EXCEEDED',message:'sensitive provider details'});
    }));return socket;
  };
  try{
    assert.deepEqual(await voice.synthesizeChunk('العلم',config,new AbortController().signal),Buffer.from([1,0,2,0]));
    assert.equal(closed,1);
    mode='failure';await assert.rejects(voice.synthesizeChunk('العلم',config,new AbortController().signal),/^Error: TTS_DEADLINE_EXCEEDED$/);assert.equal(closed,2);
    mode='wait';const c=new AbortController(),pending=voice.synthesizeChunk('العلم',config,c.signal);c.abort();
    await assert.rejects(pending,/VOICE_CANCELLED/);assert.equal(closed,3);
  }finally{delete globalThis.__voiceSocket;}
});

test('listen endpoint uses published server text, caches audio, and stops duplicate or invalid generation',async()=>{
  const state={text:'موجز منشور',cache:new Map(),generated:0,locks:new Set(),exists:true};
  globalThis.__voiceRoute={
    async getHome(){return{brief:[{title:state.text}]}},async getStory(){return state.exists?{excerpt:state.text}:null},
    async consumeLimit(scope,key){if(scope!=='voice-generation-lock')return true;if(state.locks.has(key))return false;state.locks.add(key);return true},
    async getStoredVoice(key){return state.cache.get(key)??null},async putStoredVoice(key,bytes){state.cache.set(key,bytes)},
    voiceConfig:()=>config,audioKey:voice.audioKey,speechChunks:voice.speechChunks,
    async synthesizeSummary(text){state.generated++;return voice.pcmToWav(new Uint8Array([text.length,0]))},
  };
  await build({entryPoints:['app/api/content/listen/route.ts'],outfile:`${dir}/route.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'fixture',setup(b){
    b.onResolve({filter:/^@\/lib\/(content\/provider|storage\/voice|voice\/humain|tahrir\/rate-limit)$/},args=>({path:args.path,namespace:'test'}));
    b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path.endsWith('provider')?'export const seedContentProvider=globalThis.__voiceRoute':args.path.endsWith('rate-limit')?'export const {consumeLimit}=globalThis.__voiceRoute':args.path.endsWith('humain')?'export const {voiceConfig,audioKey,speechChunks,synthesizeSummary}=globalThis.__voiceRoute':'export const {getStoredVoice,putStoredVoice}=globalThis.__voiceRoute'}));
  }}]});
  const {POST}=await import(`${dir}/route.mjs`);
  const request=(body,origin='https://alelm.net')=>new Request('https://alelm.net/api/content/listen',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
  try{
    assert.equal((await POST(request({kind:'story',storyId:'abc'}))).status,200);assert.equal(state.generated,1);
    assert.equal((await POST(request({kind:'story',storyId:'abc'}))).status,200);assert.equal(state.generated,1);
    state.text='موجز بعد التحديث';assert.equal((await POST(request({kind:'story',storyId:'abc'}))).status,200);assert.equal(state.generated,2);
    state.cache.clear();assert.equal((await POST(request({kind:'story',storyId:'abc'}))).status,409);assert.equal(state.generated,2);
    state.exists=false;assert.equal((await POST(request({kind:'story',storyId:'private-draft'}))).status,404);
    assert.equal((await POST(request({kind:'home',text:'نص زائر'}))).status,400);
    assert.equal((await POST(request({kind:'home'},'https://evil.invalid'))).status,403);
  }finally{delete globalThis.__voiceRoute;}
});
test.after(async()=>{await rm(dir,{recursive:true,force:true})});
