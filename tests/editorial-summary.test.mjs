import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const settings={tone:'عربية صحفية',models:{editorial:'editorial',light:'light',fast:'fast'},governance:{editorialGuard:false},caps:{}};
const state={requests:[],text:'',body:'',reservations:0};
const message=params=>{state.requests.push(params);return {content:[{type:'text',text:params.messages[0].content.includes('أعد المتن المحرَّر فقط')?'المتن المحرر':state.text}],usage:{input_tokens:10,output_tokens:10},stop_reason:'end_turn'}};
globalThis.__summaryTest={client:{messages:{create:async p=>message(p),stream:p=>({finalMessage:async()=>message(p)})}},settings,
  getStory:async()=>({title:'عنوان سياقي',excerpt:'وصف قديم غير معتمد',body:state.body}),
  budgetGate:async()=>{state.reservations++;return {ok:true,reservationId:'test'}}};
const output=await build({stdin:{contents:"export {runEditorialTool} from './lib/ai/editorial'; export {runReaderTool} from './lib/ai/reader'; export {validateExcerpt} from './lib/ai/summary-editorial';",loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'summary-fixtures',setup(b){
  const sources={
    'text-client':'export const textClient=()=>globalThis.__summaryTest.client',
    '@/lib/ai/settings':'export const loadAiSettings=async()=>globalThis.__summaryTest.settings',
    '@/lib/content/provider':'export const seedContentProvider={getStory:globalThis.__summaryTest.getStory}',
    '@/lib/ai/usage':'export const budgetGate=globalThis.__summaryTest.budgetGate; export const costCents=()=>1; export const logUsage=async()=>{}',
    '@/lib/policy':'export const runPolicyGuard=()=>({findings:[]})',
  };
  b.onResolve({filter:/text-client|^@\//},args=>{const key=args.path.includes('text-client')?'text-client':args.path;return sources[key]?{path:key,namespace:'mock'}:undefined});
  b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:sources[args.path],loader:'js'}));
}}]});
const compiled={exports:{}};
new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const {runEditorialTool,runReaderTool,validateExcerpt}=compiled.exports;
const excerpt='أظهرت الدراسة انخفاض استهلاك الطاقة بنسبة 12% في المباني المشاركة، دون إثبات استمرار الأثر خارج فترة التجربة.';
const input={title:'دراسة عن استهلاك الطاقة',body:'معلومات سياقية. '.repeat(900)+'النتيجة الأخيرة: انخفض الاستهلاك 12% خلال التجربة فقط.'};
const pack={title:'المباني تخفض استهلاك الطاقة خلال تجربة',excerpt,seoTitle:'دراسة استهلاك الطاقة',seoDescription:'نتائج تجربة المباني',keywords:['الطاقة'],section:'sciences',format:'news',seriesSlug:null};

test('summary validation rejects duplicate headlines, teasers and overflow without cutting valid copy',()=>{
  assert.equal(validateExcerpt(excerpt,input.title),excerpt);
  for(const value of [input.title+'!', 'تعرف على أبرز نتائج الدراسة.', 'ك'.repeat(181),null]) assert.throws(()=>validateExcerpt(value,input.title),{name:'EditorialOutputError'});
});
test('all editorial summary entry points preserve end-of-source facts and reject unusable summaries',async()=>{
  for(const tool of ['excerpt','metadata','full_edit']){
    state.requests=[];state.text=JSON.stringify(tool==='excerpt'?{suggestions:[excerpt]}:pack);
    const result=await runEditorialTool(tool,input,settings);
    const resultText=tool==='excerpt'?result.suggestions[0].text:tool==='metadata'?result.metadata.excerpt.text:result.fullEdit.excerpt.text;
    assert.equal(resultText,excerpt);
    const request=state.requests.find(p=>!p.messages[0].content.includes('أعد المتن المحرَّر فقط'));
    assert.ok(request.messages[0].content.endsWith(input.body));
    if(tool==='full_edit') assert.ok(state.requests.every(p=>p.messages[0].content.endsWith(input.body)));
    state.text=JSON.stringify(tool==='excerpt'?{suggestions:['ك'.repeat(181)]}:{...pack,excerpt:'ك'.repeat(181)});
    await assert.rejects(runEditorialTool(tool,input,settings),{name:'EditorialOutputError'});
  }
});
test('reader summary uses complete body beyond the old cutoff and never substitutes an old excerpt',async()=>{
  state.requests=[];state.body='<p>'+input.body+'</p>';state.text='خلاصة النتيجة مع قيد التجربة.';
  assert.deepEqual(await runReaderTool('summary','story'),{text:state.text});
  const prompt=state.requests[0].messages[0].content;
  assert.ok(prompt.includes('النتيجة الأخيرة: انخفض الاستهلاك 12% خلال التجربة فقط.'));
  assert.ok(!prompt.includes('وصف قديم غير معتمد'));
  for(const body of ['', 'ن'.repeat(40001)]){
    state.body=body;state.reservations=0;state.requests=[];
    assert.equal((await runReaderTool('summary','story')).status,422);
    assert.equal(state.reservations,0);assert.equal(state.requests.length,0);
  }
});
test.after(()=>{delete globalThis.__summaryTest});
