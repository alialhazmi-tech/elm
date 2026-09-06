import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { SHARING_VERSION } from '../lib/sharing-contract.ts';

test('metadata requires approval, rejects stale results and copies saved links accurately',async()=>{
  await mkdir(`${process.cwd()}/tmp`, { recursive: true });
  const dir=await mkdtemp(`${process.cwd()}/tmp/metadata-ui-`);
  const originalFetch=globalThis.fetch, originalWindow=globalThis.window, originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  let slots=[], cursor=0;
  globalThis.__metadataHooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useRef(initial){const i=cursor++;return slots[i]??={current:initial}},useSyncExternalStore(_subscribe,get){return get()}};
  try{
    await build({stdin:{contents:"export {MetadataGenerator} from './components/tahrir/editor/metadata-generator';export {ArticleLinks} from './components/tahrir/editor/article-links';",loader:'ts',resolveDir:process.cwd()},outfile:`${dir}/subject.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',plugins:[{name:'fixture',setup(b){
      b.onResolve({filter:/^(react|lucide-react|@\/components\/ui\/(button|dialog))$/},args=>({path:args.path,namespace:'fixture'}));
      b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='react'?'export const {useState,useRef,useSyncExternalStore}=globalThis.__metadataHooks':args.path==='lucide-react'?'export const SparklesIcon="svg",CopyIcon="svg"':args.path.endsWith('button')?'export const Button="button"':'export const Dialog="dialog",DialogContent="div",DialogDescription="p",DialogHeader="header",DialogTitle="h2"'}));
    }}]});
    const {MetadataGenerator,ArticleLinks}=await import(`${dir}/subject.mjs`);
    let revision=0,calls=0;const applied=[],busyChanges=[];
    const verdict={ok:true,findings:[]};const data={excerpt:{text:'موجز',guard:verdict},seo:{seoTitle:'عنوان بحث',seoDescription:'وصف',keywords:['علوم'],guard:verdict},classify:{section:'sciences',format:'news',seriesSlug:'limatha'}};
    const props={disabled:false,lockedSection:null,getDraft:()=>({title:'العنوان الحالي',body:'المتن الحالي',revision}),onApply:p=>applied.push(p),onBusyChange:busy=>busyChanges.push(busy),sections:[['sciences','العلوم']],formats:[['news','خبر']],series:[{slug:'limatha',name:'لماذا'}]};
    const nodes=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];
    let component=()=>MetadataGenerator(props);const render=()=>{cursor=0;return component()};
    const button=name=>nodes(render()).find(n=>n.type==='button'&&[n.props.children].flat(Infinity).includes(name));
    globalThis.fetch=async(_url,opts)=>{calls++;assert.equal(JSON.parse(opts.body).tool,'metadata');return Response.json({metadata:data})};
    await button('توليد الملحقات').props.onClick();assert.equal(calls,1);assert.equal(applied.length,0);assert.match(JSON.stringify(render()),/العلوم/);assert.match(JSON.stringify(render()),/لماذا/);
    revision++;button('اعتماد الملحقات').props.onClick();assert.equal(applied.length,0);assert.match(JSON.stringify(render()),/تغيّرت المسودة/);
    await button('إعادة توليد الملحقات').props.onClick();button('اعتماد الملحقات').props.onClick();assert.equal(applied.length,1);assert.equal(applied[0].body,undefined);assert.equal(applied[0].title,undefined);
    globalThis.fetch=async()=>Response.json({error:'سقف الإنفاق الداخلي'},{status:429});await button('توليد الملحقات').props.onClick();assert.match(JSON.stringify(render()),/سقف الإنفاق/);assert.equal(button('اعتماد الملحقات'),undefined);
    for (const [response,expected] of [
      [new Response('<html>Bad Gateway</html>',{status:502,headers:{'Content-Type':'text/html'}}),/تعذّر إكمال التوليد \(502\)/],
      [new Response('',{status:504}),/انتهت مهلة/],
      [new Response('',{status:401}),/انتهت جلسة/],
      [new Response('<html>Sign in</html>',{headers:{'Content-Type':'text/html'}}),/رد غير صالح/],
      [new Response('{"metadata":'),/رد غير صالح/],
      [Response.json(null),/رد غير صالح/],
      [Response.json([]),/رد غير صالح/],
      [Response.json({error:{detail:'raw upstream error'}},{status:502}),/تعذّر إكمال التوليد/],
      [Response.json({error:'ملحقات المادة ناقصة أو تجاوزت الحدود المطلوبة. أعد التوليد.'},{status:422}),/ملحقات المادة ناقصة/],
      [{ok:false,status:502,json:async()=>{throw new SyntaxError('The string did not match the expected pattern.')}},/تعذّر إكمال التوليد/],
    ]) {
      globalThis.fetch=async()=>response;
      await button('إعادة توليد الملحقات').props.onClick();
      assert.match(JSON.stringify(render()),expected);assert.doesNotMatch(JSON.stringify(render()),/expected pattern|Bad Gateway|Sign in|raw upstream error/);
      assert.equal(button('اعتماد الملحقات'),undefined);assert.equal(applied.length,1);
      assert.deepEqual(busyChanges.slice(-2),[true,false]);
    }
    globalThis.fetch=async()=>Response.json({metadata:data});
    await button('إعادة توليد الملحقات').props.onClick();assert.ok(button('اعتماد الملحقات'));assert.equal(applied.length,1);
    slots=[];const copied=[];globalThis.window={location:{origin:'https://alelm.net'}};
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>copied.push(text)}}});
    const links={editorId:'revision-id',identity:{id:'original-id',section:'sciences',slug:'عنوان-المادة'},published:false,dirty:false};component=()=>ArticleLinks(links);
    const inputs=()=>nodes(render()).filter(n=>n.type==='input');const copy=name=>nodes(render()).find(n=>n.type==='button'&&n.props['aria-label']===name);
    const publicUrl=inputs()[0].props.value;assert.equal(publicUrl,'https://alelm.net/sciences/original-id/'+encodeURIComponent('عنوان-المادة')+'?xcard='+SHARING_VERSION);
    copy('نسخ رابط المادة').props.onClick();await new Promise(r=>setImmediate(r));assert.deepEqual(copied,[publicUrl]);assert.match(JSON.stringify(render()),/نُسخ الرابط/);
    assert.equal(inputs().length,2);assert.equal(inputs()[1].props.value,'https://alelm.net/tahrir/editor/revision-id');
    copy('نسخ رابط المحرر للزملاء').props.onClick();await new Promise(r=>setImmediate(r));assert.deepEqual(copied,[publicUrl,'https://alelm.net/tahrir/editor/revision-id']);
    links.dirty=true;assert.equal(copy('نسخ رابط المادة').props.disabled,true);links.published=true;assert.equal(copy('نسخ رابط المادة').props.disabled,false);
    links.identity=null;assert.equal(copy('نسخ رابط المادة').props.disabled,true);
    assert.equal(copy('نسخ رابط المحرر للزملاء').props.disabled,false);links.editorId='';assert.equal(copy('نسخ رابط المحرر للزملاء').props.disabled,true);
  }finally{globalThis.fetch=originalFetch;globalThis.window=originalWindow;if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;delete globalThis.__metadataHooks;await rm(dir,{recursive:true,force:true})}
});
