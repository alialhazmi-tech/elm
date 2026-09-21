import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const settings={tone:'عربية صحفية',models:{editorial:'editorial',light:'light',fast:'fast'},governance:{editorialGuard:false},caps:{}};
const state={requests:[],text:'',body:'',reservations:0,stopReason:'end_turn'};
const message=params=>{state.requests.push(params);return {content:[{type:'text',text:params.messages[0].content.includes('أعد المتن المحرَّر فقط')?'المتن المحرر':(params.messages[0].content.startsWith('المحاولة السابقة') && state.repairText ? state.repairText : state.text)}],usage:{input_tokens:10,output_tokens:10},stop_reason:state.stopReason}};
globalThis.__summaryTest={client:{messages:{create:async p=>message(p),stream:p=>({finalMessage:async()=>message(p)})}},settings,
  getStory:async()=>({title:'عنوان سياقي',excerpt:'وصف قديم غير معتمد',body:state.body}),
  budgetGate:async()=>{state.reservations++;return {ok:true,reservationId:'test'}}};
const output=await build({stdin:{contents:"export {runEditorialTool} from './lib/ai/editorial'; export {runReaderTool} from './lib/ai/reader'; export {validateExcerpt} from './lib/ai/summary-editorial'; export {visibleTaxonomy} from './lib/content/taxonomy'; export {POST as readerPost} from './app/api/me/ai/route';",loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'summary-fixtures',setup(b){
  const sources={
    'text-client':'export const textClient=()=>globalThis.__summaryTest.client',
    '@/lib/ai/settings':'export const loadAiSettings=async()=>globalThis.__summaryTest.settings',
    '@/lib/content/provider':'export const seedContentProvider={getStory:globalThis.__summaryTest.getStory}',
    '@/lib/ai/usage':'export const budgetGate=globalThis.__summaryTest.budgetGate; export const costCents=()=>1; export const logUsage=async()=>{}',
    '@/lib/policy':'export const runPolicyGuard=()=>({findings:[]})',
    '@/lib/personalization':'export const getSessionMemberId=async()=>"test-member"; export const persistStatsAndSignal=async()=>{}; export const privateJson=(body,status=200)=>Response.json(body,{status});',
    '@/lib/tahrir/rate-limit':'export const consumeLimit=async()=>true;',
  };
  b.onResolve({filter:/text-client|^@\//},args=>{const key=args.path.includes('text-client')?'text-client':args.path;return sources[key]?{path:key,namespace:'mock'}:undefined});
  b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:sources[args.path],loader:'js'}));
}}]});
const compiled={exports:{}};
new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const {runEditorialTool,runReaderTool,validateExcerpt,visibleTaxonomy,readerPost}=compiled.exports;
const excerpt='أظهرت الدراسة انخفاض استهلاك الطاقة بنسبة 12% في المباني المشاركة، دون إثبات استمرار الأثر خارج فترة التجربة.';
const input={title:'دراسة عن استهلاك الطاقة',body:'معلومات سياقية. '.repeat(900)+'النتيجة الأخيرة: انخفض الاستهلاك 12% خلال التجربة فقط.'};
const pack={title:'المباني تخفض استهلاك الطاقة خلال تجربة',excerpt,seoTitle:'دراسة استهلاك الطاقة',seoDescription:'نتائج تجربة المباني',keywords:['الطاقة'],section:'sciences',format:'news',seriesSlug:null};

test('summary validation rejects duplicate headlines, teasers and overflow without cutting valid copy',()=>{
  assert.equal(validateExcerpt(excerpt,input.title),excerpt);
  for(const value of [input.title+'!', 'تعرف على أبرز نتائج الدراسة.', 'ك'.repeat(501),null]) assert.throws(()=>validateExcerpt(value,input.title),{name:'EditorialOutputError'});
});
test('all editorial summary entry points preserve end-of-source facts and reject unusable summaries',async()=>{
  for(const tool of ['excerpt','metadata','full_edit']){
    state.requests=[];state.text=JSON.stringify(tool==='excerpt'?{suggestions:[excerpt]}:pack);
    const result=await runEditorialTool(tool,input,settings);
    const resultText=tool==='excerpt'?result.suggestions[0].text:tool==='metadata'?result.metadata.excerpt.text:result.fullEdit.excerpt.text;
    assert.equal(resultText,excerpt);
    const request=state.requests.find(p=>!p.messages[0].content.includes('أعد المتن المحرَّر فقط'));
    assert.ok(request.messages[0].content.endsWith(input.body));
    assert.equal(request.model, settings.models.editorial, "كل موجز يستخدم نموذج التحرير الأقوى");
    if(tool==='full_edit') assert.ok(state.requests.every(p=>p.messages[0].content.endsWith(input.body)));
    state.text=JSON.stringify(tool==='excerpt'?{suggestions:['ك'.repeat(501)]}:{...pack,excerpt:'ك'.repeat(501)});
    await assert.rejects(runEditorialTool(tool,input,settings),{name:'EditorialOutputError'});
  }
});
test('all three generation paths preserve a multi-sentence excerpt above the old limit without truncation',async()=>{
  const comprehensive='أظهرت دراسة شملت 120 مبنى خلال 6 أشهر انخفاض استهلاك الكهرباء بنسبة 12% مع نظام التبريد الآلي مقارنة بالنظام المعتاد، مقابل ارتفاع تكاليف الصيانة 4%. اقتصرت التجربة على مبانٍ مكتبية ولم تشمل المنازل، ويعتزم الفريق متابعتها عامًا إضافيًا. وأكد الباحثون أن النتائج لا تثبت استمرار التوفير بعد انتهاء التجربة ولا تسمح بتعميمه على أنواع المباني الأخرى.';
  assert.ok(Array.from(comprehensive).length > 280 && Array.from(comprehensive).length <= 500);
  for (const tool of ['excerpt','metadata','full_edit']) {
    state.requests=[];state.text=JSON.stringify(tool==='excerpt'?{suggestions:[comprehensive]}:{...pack,excerpt:comprehensive});
    const result=await runEditorialTool(tool,input,settings);
    assert.equal(tool==='excerpt'?result.suggestions[0].text:tool==='metadata'?result.metadata.excerpt.text:result.fullEdit.excerpt.text,comprehensive);
    assert.equal(state.requests.length,tool==='full_edit'?2:1);
  }
});
test('reader summary uses complete body beyond the old cutoff and never substitutes an old excerpt',async()=>{
  const points=['انخفض استهلاك الطاقة بنسبة 12% في المباني المشاركة.','شملت الدراسة فترة التجربة فقط.','لم تثبت الدراسة استمرار الأثر خارج التجربة.'];
  state.requests=[];state.body='<p>'+input.body+'</p>';state.text=JSON.stringify({points});
  assert.deepEqual(await runReaderTool('summary','story'),{text:points.map(point=>'• '+point).join('\n'),points});
  const prompt=state.requests[0].messages[0].content;
  assert.ok(prompt.includes('النتيجة الأخيرة: انخفض الاستهلاك 12% خلال التجربة فقط.'));
  assert.ok(!prompt.includes('وصف قديم غير معتمد'));
  assert.ok(prompt.includes('ثلاث نقاط مستقلة بالضبط'));
  for(const body of ['', 'ن'.repeat(40001)]){
    state.body=body;state.reservations=0;state.requests=[];
    assert.equal((await runReaderTool('summary','story')).status,422);
    assert.equal(state.reservations,0);assert.equal(state.requests.length,0);
  }
});
test('reader summary rejects paragraphs and malformed point counts without truncating or inventing points',async()=>{
  state.body='<p>انخفض المؤشر 3.5% خلال التجربة. شملت التجربة 1500 حالة. لم يثبت استمرار الأثر.</p>';
  const points=['انخفض المؤشر 3.5% خلال التجربة.','شملت التجربة 1500 حالة.','لم يثبت استمرار الأثر.'];
  state.text='```json\n'+JSON.stringify({points})+'\n```';
  assert.deepEqual((await runReaderTool('summary','story')).points,points);
  for(const invalid of [points.join(' '),'{bad json}',JSON.stringify({points:points.slice(0,2)}),JSON.stringify({points:[...points,'تفصيل إضافي.']}),JSON.stringify({points:['أولًا',' ', 'ثالثًا']}),JSON.stringify({points:['نقطة','نقطة.', 'ثالثة']}),JSON.stringify({points:[1,2,3]})]){
    state.text=invalid;
    const result=await runReaderTool('summary','story');
    assert.equal(result.status,502);assert.match(result.error,/ثلاث نقاط/);assert.equal(result.text,undefined);
  }
  state.text=JSON.stringify({points});state.stopReason='max_tokens';
  assert.equal((await runReaderTool('summary','story')).status,502);
  state.stopReason='end_turn';state.text='إجابة مستقلة عن سؤال القارئ.';
  assert.deepEqual(await runReaderTool('discuss','story','ماذا حدث؟'),{text:state.text});
});
test('member AI endpoint returns the three validated points and preserves text for existing clients',async()=>{
  state.body=input.body;state.stopReason='end_turn';
  const points=['انخفض استهلاك الطاقة بنسبة 12%.','اقتصرت النتيجة على المباني المشاركة.','لم يثبت استمرار الأثر بعد التجربة.'];
  const request=()=>new Request('https://alelm.net/api/me/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:'summary',storyId:'story'})});
  state.text=JSON.stringify({points});
  const response=await readerPost(request());
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{points,text:points.map(point=>'• '+point).join('\n')});
  state.text=points.join(' ');
  const invalid=await readerPost(request());assert.equal(invalid.status,502);assert.match((await invalid.json()).error,/ثلاث نقاط/);
});

test('summaries allow up to 500 characters, normalize whitespace and accept shorter text',()=>{
  for (const length of [180,181,250,280,350,500]) assert.equal(validateExcerpt('ك'.repeat(length),input.title).length,length);
  assert.equal(validateExcerpt('  نتيجة   الدراسة.  ',input.title),'نتيجة الدراسة.');
});
test('one excerpt-only repair preserves the metadata and accounts for every completed call',async()=>{
  try {
    for (const tool of ['excerpt','metadata','full_edit']) {
      state.requests=[]; state.stopReason='end_turn';
      state.text=JSON.stringify(tool==='excerpt'?{suggestions:['ك'.repeat(501)]}:{...pack,excerpt:'ك'.repeat(501)});
      state.repairText=JSON.stringify({suggestions:[excerpt]});
      const usages=[];
      const result=await runEditorialTool(tool,input,settings,{onUsage:u=>usages.push(u)});
      assert.equal(tool==='excerpt'?result.suggestions[0].text:tool==='metadata'?result.metadata.excerpt.text:result.fullEdit.excerpt.text,excerpt);
      assert.equal(state.requests.length,tool==='full_edit'?3:2);
      assert.equal(result.usages.length,state.requests.length);
      assert.equal(usages.length,state.requests.length);
      assert.equal(result.usage.inputTokens,10*state.requests.length);
      assert.equal(state.requests.at(-1).model,settings.models.editorial);
      if(tool==='metadata') assert.equal(result.metadata.seo.seoTitle,pack.seoTitle);
    }
    state.requests=[];state.text=JSON.stringify({suggestions:['ك'.repeat(501)]});state.repairText=state.text;
    await assert.rejects(runEditorialTool('excerpt',input,settings),/500/);
    assert.equal(state.requests.length,2);
  } finally { state.repairText=null; }
});
test('hidden sections and series are excluded from every classification prompt and rejected in results',async()=>{
  const taxonomy=visibleTaxonomy({'section:sciences':true,'series:limatha':true});
  for(const tool of ['classify','metadata','full_edit']){
    state.requests=[];state.text=JSON.stringify({...pack,section:'news',seriesSlug:null});
    await runEditorialTool(tool,input,settings,{taxonomy});
    const prompt=state.requests.find(p=>!p.messages[0].content.includes('أعد المتن المحرَّر فقط')).messages[0].content;
    assert.doesNotMatch(prompt,/sciences|limatha/);
    for(const hidden of [{section:'sciences',seriesSlug:null},{section:'news',seriesSlug:'limatha'}]){
      state.text=JSON.stringify({...pack,...hidden});
      await assert.rejects(runEditorialTool(tool,input,settings,{taxonomy}),/مخفية/);
    }
  }
  state.text=JSON.stringify({...pack,section:'sciences',seriesSlug:'limatha'});
  assert.equal((await runEditorialTool('classify',input,settings,{taxonomy:visibleTaxonomy()})).classify.section,'sciences');
});

test.after(()=>{delete globalThis.__summaryTest});
