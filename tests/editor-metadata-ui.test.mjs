import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { build } from 'esbuild';

test('metadata requires approval, rejects stale results and copies saved links accurately',async()=>{
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
    let revision=0,calls=0;const applied=[];
    const verdict={ok:true,findings:[]};const data={excerpt:{text:'موجز',guard:verdict},seo:{seoTitle:'عنوان بحث',seoDescription:'وصف',keywords:['علوم'],guard:verdict},classify:{section:'sciences',format:'news',seriesSlug:'limatha'}};
    const props={disabled:false,lockedSection:null,getDraft:()=>({title:'العنوان الحالي',body:'المتن الحالي',revision}),onApply:p=>applied.push(p),onBusyChange:()=>{},sections:[['sciences','العلوم']],formats:[['news','خبر']],series:[{slug:'limatha',name:'لماذا'}]};
    const nodes=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];
    let component=()=>MetadataGenerator(props);const render=()=>{cursor=0;return component()};
    const button=name=>nodes(render()).find(n=>n.type==='button'&&[n.props.children].flat(Infinity).includes(name));
    globalThis.fetch=async(_url,opts)=>{calls++;assert.equal(JSON.parse(opts.body).tool,'metadata');return Response.json({metadata:data})};
    await button('توليد الملحقات').props.onClick();assert.equal(calls,1);assert.equal(applied.length,0);assert.match(JSON.stringify(render()),/العلوم/);assert.match(JSON.stringify(render()),/لماذا/);
    revision++;button('اعتماد الملحقات').props.onClick();assert.equal(applied.length,0);assert.match(JSON.stringify(render()),/تغيّرت المسودة/);
    await button('إعادة توليد الملحقات').props.onClick();button('اعتماد الملحقات').props.onClick();assert.equal(applied.length,1);assert.equal(applied[0].body,undefined);assert.equal(applied[0].title,undefined);
    globalThis.fetch=async()=>Response.json({error:'سقف الإنفاق الداخلي'},{status:429});await button('توليد الملحقات').props.onClick();assert.match(JSON.stringify(render()),/سقف الإنفاق/);assert.equal(button('اعتماد الملحقات'),undefined);
    slots=[];const copied=[];globalThis.window={location:{origin:'https://alelm.net'}};
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>copied.push(text)}}});
    const links={identity:{id:'original-id',section:'sciences',slug:'عنوان-المادة'},editorId:'revision-id',published:false,dirty:false};component=()=>ArticleLinks(links);
    const inputs=()=>nodes(render()).filter(n=>n.type==='input');const copy=name=>nodes(render()).find(n=>n.type==='button'&&n.props['aria-label']===name);
    const publicUrl=inputs()[0].props.value;assert.equal(publicUrl,'https://alelm.net/sciences/original-id/'+encodeURIComponent('عنوان-المادة'));
    copy('نسخ رابط المادة').props.onClick();await new Promise(r=>setImmediate(r));assert.deepEqual(copied,[publicUrl]);assert.match(JSON.stringify(render()),/نُسخ الرابط/);
    copy('نسخ رابط المحرر للزملاء').props.onClick();await new Promise(r=>setImmediate(r));assert.equal(copied[1],'https://alelm.net/tahrir/editor/revision-id');
    links.dirty=true;assert.equal(copy('نسخ رابط المادة').props.disabled,true);links.published=true;assert.equal(copy('نسخ رابط المادة').props.disabled,false);
    links.identity=null;links.editorId='';assert.equal(copy('نسخ رابط المادة').props.disabled,true);assert.equal(copy('نسخ رابط المحرر للزملاء').props.disabled,true);
  }finally{globalThis.fetch=originalFetch;globalThis.window=originalWindow;if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;delete globalThis.__metadataHooks;await rm(dir,{recursive:true,force:true})}
});
