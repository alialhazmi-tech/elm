import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { build } from 'esbuild';

// Exercise the real component handlers without calling a paid provider.
test('field generation requires content, proposes before applying, protects edits and handles failures', async () => {
  await mkdir(`${process.cwd()}/tmp`, { recursive: true });
  const dir = await mkdtemp(`${process.cwd()}/tmp/field-generator-`);
  const originalFetch = globalThis.fetch;
  const slots = []; let cursor = 0;
  globalThis.__fieldHooks = {
    useState(initial) { const i=cursor++; if (!(i in slots)) slots[i]=initial; return [slots[i], value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]; },
    useRef(initial) { const i=cursor++; if (!(i in slots)) slots[i]={current:initial}; return slots[i]; },
  };
  try {
    await build({entryPoints:['components/tahrir/editor/field-generator.tsx'],outfile:`${dir}/subject.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',plugins:[{name:'hooks',setup(b){
      b.onResolve({filter:/^(react|lucide-react|@\/components\/ui\/button)$/},args=>({path:args.path,namespace:'fixture'}));
      b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='react'?'export const {useState,useRef}=globalThis.__fieldHooks':args.path==='lucide-react'?'export const SparklesIcon="svg"':'export const Button="button"'}));
    }}]});
    const {FieldGenerator}=await import(`${dir}/subject.mjs`);
    let draft={title:'عنوان حالي',body:'',revision:0}; const applied=[]; let calls=0;
    const props={tool:'headlines',getDraft:()=>draft,onApply:text=>applied.push(text),disabled:false};
    const nodes=(node)=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(nodes)];
    const render=()=>{cursor=0; return FieldGenerator(props)};
    const find=(name)=>nodes(render()).find(n=>n.type==='button'&&[n.props.children].flat(Infinity).includes(name));
    const text=()=>JSON.stringify(render());
    globalThis.fetch=async(_url,options)=>{calls++; assert.equal(JSON.parse(options.body).tool,'headlines');return Response.json({suggestions:[{text:'عنوان مقترح',guard:{ok:true,findings:[]}}]})};
    await find('توليد العنوان').props.onClick(); assert.equal(calls,0); assert.match(text(),/أضف متن المادة/);
    draft={...draft,body:'متن المادة من المصدر'};
    await find('توليد العنوان').props.onClick(); assert.equal(calls,1); assert.equal(applied.length,0);
    draft.revision++;
    find('اعتماد العنوان').props.onClick(); assert.equal(applied.length,0); assert.match(text(),/تغيّرت المسودة/);
    await find('توليد العنوان').props.onClick(); find('اعتماد العنوان').props.onClick(); assert.deepEqual(applied,['عنوان مقترح']);
    globalThis.fetch=async()=>Response.json({error:'سقف الإنفاق الداخلي'}, {status:429});
    await find('توليد العنوان').props.onClick(); assert.match(text(),/سقف الإنفاق الداخلي/); assert.equal(find('اعتماد العنوان'),undefined);
    props.tool='excerpt';
    globalThis.fetch=async()=>Response.json({suggestions:[{text:'خ'.repeat(181),guard:{ok:true,findings:[]}}]});
    await find('توليد الموجز الذكي').props.onClick(); assert.equal(find('اعتماد الموجز').props.disabled,true);
    globalThis.fetch=async()=>Response.json({suggestions:[{text:'موجز مرفوض',guard:{ok:false,findings:[{message:'معلومة غير موثقة'}]}}]});
    await find('توليد الموجز الذكي').props.onClick(); assert.equal(find('اعتماد الموجز').props.disabled,true);
    let complete;
    globalThis.fetch=()=>{calls++; return new Promise(resolve=>{complete=resolve})};
    const before=calls; const generate=find('توليد الموجز الذكي').props.onClick;
    const first=generate(); await generate(); assert.equal(calls,before+1);
    complete(Response.json({suggestions:[{text:'موجز المادة',guard:{ok:true,findings:[]}}]})); await first;
    find('اعتماد الموجز').props.onClick(); assert.equal(applied.at(-1),'موجز المادة');
  } finally { globalThis.fetch=originalFetch; delete globalThis.__fieldHooks; await rm(dir,{recursive:true,force:true}); }
});
