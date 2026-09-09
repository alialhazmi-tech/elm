import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const settings = { caps: { dailyUsd: 10, monthlyUsd: 150 }, models: { fast: 'fast' }, tools: { full_edit: true, metadata: true } };
const output = await build({ stdin: { contents: "export {POST} from './app/api/tahrir/ai/assist/route'; export {EditorialOutputError} from './lib/ai/output-error';", loader: 'ts', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  plugins: [{ name: 'route-dependencies', setup(builder) {
    const sources = {
      '@/lib/ai/editorial': `export const AI_TOOLS=['metadata','full_edit']; export const editorialReservationCents=()=>37; export const runEditorialTool=(...args)=>globalThis.__aiTest.run(...args);`,
      '@/lib/ai/settings': `export const loadAiSettings=()=>globalThis.__aiTest.settings;`,
      '@/lib/ai/text-client': `export const textClient=()=>globalThis.__aiTest.key?{}:null;`,
      '@/lib/ai/provider-config': `export const missingTextKeyMessage=()=>"مفتاح غير مضبوط";`,
      '@/lib/ai/usage': `export const costCents=(_m,i,o)=>i+o; export const budgetGate=async(caps,estimate)=>{globalThis.__aiTest.reservations.push({caps,estimate});return {ok:true,reservationId:'reserved'}}; export const logUsage=async entry=>globalThis.__aiTest.entries.push(entry);`,
      '@/lib/tahrir/access': `export const requirePermission=async()=>({ok:true,actor:{username:'tester'}}); export const canEditStory=(_actor,story)=>story?.id==='allowed';`,
      '@/lib/tahrir/service': `export const getStory=async id=>id==='allowed'?{id}:null; export const audit=async(...args)=>{if(globalThis.__aiTest.auditFails)throw new Error('audit down');globalThis.__aiTest.audits.push(args)};`,
    };
    builder.onResolve({ filter: /^@\// }, args => sources[args.path] ? { path: args.path, namespace: 'mock' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: sources[args.path], loader: 'js' }));
  } }] });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', output.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const post = (tool='metadata', body='نص المصدر') => compiled.exports.POST(new Request('http://localhost/api/tahrir/ai/assist', { method:'POST',headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'},body:JSON.stringify({tool,body,title:'المصدر'}) }));
const usage = { model:'fast',inputTokens:2,outputTokens:3 };
async function isolated(fn) {
  globalThis.__aiTest={settings,key:true,reservations:[],entries:[],audits:[],run:async()=>({suggestions:[],usage})};
  const log=console.error; const logs=[]; console.error=(...args)=>logs.push(args);
  try {await fn(globalThis.__aiTest,logs);}finally{console.error=log;delete globalThis.__aiTest;}
}

test('AI route reserves the computed amount, settles success once, and isolates audit failure',()=>isolated(async state=>{
  state.auditFails=true;
  const r=await post(); assert.equal(r.status,200);assert.equal((await r.json()).ok,true);
  assert.deepEqual(state.reservations,[{caps:settings.caps,estimate:37}]);
  assert.equal(state.entries.length,1);assert.equal(state.entries[0].costCents,5);assert.equal(state.entries[0].tool,'metadata');
}));

test('AI route settles measured output on parse failure and retains only uncertainty',()=>isolated(async(state,logs)=>{
  state.run=async(_tool,_input,_settings,options)=>{options.onUsage(usage);throw new Error('مخرج غير صالح');};
  let r=await post();assert.equal(r.status,502);assert.equal(state.entries[0].costCents,5);assert.equal(state.entries[0].tool,'metadata:failed');
  state.run=async(_tool,_input,_settings,options)=>{options.onUsage(usage);options.onUnmeasured(12);throw new Error('اتصال منقطع');};
  r=await post();assert.equal(r.status,502);assert.equal(state.entries[1].costCents,17);assert.equal(state.entries[1].tool,'metadata:unmeasured');
  state.run=async()=>{throw new Error('رفض الطلب قبل التوليد');};
  r=await post();assert.equal(r.status,502);assert.equal(state.entries[2].costCents,0);
  assert.equal(logs.filter(([name])=>name==='AI_GENERATION_FAILED').length,3);
  assert.ok(!JSON.stringify(logs).includes('نص المصدر'));
}));

test('empty text or missing provider key never creates a reservation',()=>isolated(async state=>{
  assert.equal((await post('full_edit','')).status,400);
  assert.equal((await post('full_edit','ن'.repeat(40001))).status,400);
  state.key=false;assert.equal((await post()).status,503);
  assert.equal(state.entries.length,0);assert.equal(state.reservations.length,0);
}));

test('rejected model output returns an actionable JSON response and settles completed usage once',()=>isolated(async(state,logs)=>{
  const message='ملحقات المادة ناقصة أو تجاوزت الحدود المطلوبة. أعد التوليد.';
  state.run=async(_tool,_input,_settings,options)=>{options.onUsage(usage);throw new compiled.exports.EditorialOutputError(message);};
  const r=await post();assert.equal(r.status,422);assert.match(r.headers.get('Content-Type'),/application\/json/);
  assert.deepEqual(await r.json(),{error:message});
  assert.equal(state.reservations.length,1);assert.equal(state.entries.length,1);assert.equal(state.entries[0].costCents,5);
  assert.equal(state.entries[0].tool,'metadata:failed');
  assert.equal(logs.find(([name])=>name==='AI_GENERATION_FAILED')[1].errorType,'EditorialOutputError');
}));

test('full-edit response sends heartbeat while working then settles and returns a clear error',()=>isolated(async state=>{
  let heartbeat, cleared=false, finish;
  const set=globalThis.setInterval, clear=globalThis.clearInterval;
  globalThis.setInterval=(fn,ms)=>{assert.equal(ms,10000);heartbeat=fn;return 123;};
  globalThis.clearInterval=id=>{assert.equal(id,123);cleared=true;};
  state.run=async(_tool,_input,_settings,options)=>{
    options.onFullEditProgress('accepted');
    await new Promise(resolve=>{finish=resolve;});options.onUsage(usage);throw new Error('تعذر إكمال الملحقات');
  };
  try {
    const r=await post('full_edit');assert.match(r.headers.get('Content-Type'),/ndjson/);
    const reader=r.body.getReader(),decoder=new TextDecoder();
    const first=decoder.decode((await reader.read()).value);assert.match(first,/accepted/);
    heartbeat();assert.match(decoder.decode((await reader.read()).value),/heartbeat/);
    finish();const error=decoder.decode((await reader.read()).value);assert.match(error,/تعذر إكمال الملحقات/);
    assert.equal((await reader.read()).done,true);assert.equal(cleared,true);
    assert.equal(state.entries.length,1);assert.equal(state.entries[0].costCents,5);
  }finally{globalThis.setInterval=set;globalThis.clearInterval=clear;}
}));

test('story-linked AI events require live story access and use the authenticated actor',()=>isolated(async state=>{
  const request=id=>new Request('http://localhost/api/tahrir/ai/assist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:'metadata',body:'نص المصدر',storyId:id,actor:'forged'})});
  assert.equal((await compiled.exports.POST(request('private'))).status,403);
  assert.equal(state.reservations.length,0);assert.equal(state.audits.length,0);
  assert.equal((await compiled.exports.POST(request('allowed'))).status,200);
  assert.deepEqual(state.audits.map(row=>row.slice(0,3)),[['tester','ai:started','allowed'],['tester','ai:metadata','allowed']]);
}));
