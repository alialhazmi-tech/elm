import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { build } from 'esbuild';

function harness() {
  const slots=[]; let index=0, dirty=false, component, value, now=0, serial=0;
  const effects=[]; const timers=new Map(); const storage=new Map(); const session=new Map(); const listeners=new Map();
  const hooks={
    useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],next=>{const v=typeof next==='function'?next(slots[i]):next;if(!Object.is(slots[i],v)){slots[i]=v;dirty=true}}]},
    useRef(initial){const i=index++;return slots[i]??=( {current:initial})},
    useEffect(fn,deps){const i=index++;const prev=slots[i];if(!prev||!deps||deps.some((d,j)=>!Object.is(d,prev.deps[j]))){slots[i]={deps,cleanup:prev?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=fn()})}},
    useEffectEvent(fn){const i=index++;slots[i]??={run:(...args)=>slots[i].fn(...args)};slots[i].fn=fn;return slots[i].run},
  };
  const browser={setTimeout(fn,delay){const id=++serial;timers.set(id,{at:now+delay,fn});return id},clearTimeout(id){timers.delete(id)},addEventListener(name,fn){listeners.set(name,fn)},removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name)}};
  function render(){do{dirty=false;index=0;value=component();while(effects.length)effects.shift()()}while(dirty);return value}
  return {hooks,browser,storage,session,listeners,render,unmount(){for(const slot of slots)slot?.cleanup?.()},get value(){return value},mount(fn){component=fn;return render()},
    get now(){return now}, set now(v){now=v},
    async tick(ms){const end=now+ms;let due;while((due=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0])){now=due[1].at;timers.delete(due[0]);due[1].fn();await Promise.resolve();render()}now=end;await Promise.resolve();render()},
  };
}

async function load(dir){
  await build({stdin:{contents:"export {useDraftRecovery,useDraftTabToken} from './components/tahrir/use-draft-recovery';",loader:'ts',resolveDir:process.cwd()},outfile:`${dir}/hooks.mjs`,bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'hooks',setup(b){b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:'const h=()=>globalThis.__draftHooks;export const useState=(...a)=>h().useState(...a),useRef=(...a)=>h().useRef(...a),useEffect=(...a)=>h().useEffect(...a),useEffectEvent=(...a)=>h().useEffectEvent(...a),useCallback=(...a)=>h().useCallback(...a)'}))}}]});
  return import(`${dir}/hooks.mjs`);
}

test('local recovery stores the server version and flags a newer server version instead of silently overriding it',async()=>{
  await mkdir(`${process.cwd()}/tmp`,{recursive:true});
  const dir=await mkdtemp(`${process.cwd()}/tmp/recovery-`);
  const originals={window:globalThis.window,localStorage:globalThis.localStorage,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,Date:globalThis.Date};
  const h=harness(); globalThis.__draftHooks=h.hooks;globalThis.window=h.browser;
  globalThis.localStorage={getItem:k=>h.storage.get(k)??null,setItem:(k,v)=>h.storage.set(k,v),removeItem:k=>h.storage.delete(k)};
  globalThis.requestAnimationFrame=fn=>h.browser.setTimeout(fn,0);globalThis.cancelAnimationFrame=id=>h.browser.clearTimeout(id);
  const RealDate=originals.Date; let clock=1_800_000_000_000;
  globalThis.Date=class extends RealDate{constructor(...a){super(...(a.length?a:[clock]))}static now(){return clock}};
  try{
    const {useDraftRecovery}=await load(dir);
    let snapshot={title:'أصل',excerpt:'',body:''}, server={version:4,updatedAt:'2026-09-09T10:00:00.000Z'};
    h.mount(()=>useDraftRecovery('story-1',snapshot,server));
    await h.tick(0); assert.equal(h.value.recovery,null);
    snapshot={...snapshot,title:'كتابة محلية'};h.render();await h.tick(800);
    const record=JSON.parse(h.storage.get('story-1'));
    assert.equal(record.version,4); assert.equal(record.updatedAt,'2026-09-09T10:00:00.000Z'); assert.equal(JSON.parse(record.value).title,'كتابة محلية');
    h.unmount();

    // نفس النسخة على الخادم: استعادة عادية بلا تحذير
    const h2=harness(); globalThis.__draftHooks=h2.hooks; globalThis.window=h2.browser; h2.storage.set('story-1',h.storage.get('story-1'));
    globalThis.localStorage={getItem:k=>h2.storage.get(k)??null,setItem:(k,v)=>h2.storage.set(k,v),removeItem:k=>h2.storage.delete(k)};
    globalThis.requestAnimationFrame=fn=>h2.browser.setTimeout(fn,0);globalThis.cancelAnimationFrame=id=>h2.browser.clearTimeout(id);
    h2.mount(()=>useDraftRecovery('story-1',{title:'أصل',excerpt:'',body:''},{version:4}));await h2.tick(0);
    assert.equal(h2.value.recovery.title,'كتابة محلية'); assert.equal(h2.value.recoveryMeta.stale,false); assert.equal(h2.value.recoveryMeta.storedVersion,4);
    h2.value.dismiss(); h2.render(); assert.equal(h2.storage.has('story-1'),false); h2.unmount();

    // نسخة أحدث على الخادم (5): تُعرض الاستعادة لكن بوسم التعارض وبيانات المقارنة
    const h3=harness(); globalThis.__draftHooks=h3.hooks; globalThis.window=h3.browser; h3.storage.set('story-1',h.storage.get('story-1'));
    globalThis.localStorage={getItem:k=>h3.storage.get(k)??null,setItem:(k,v)=>h3.storage.set(k,v),removeItem:k=>h3.storage.delete(k)};
    globalThis.requestAnimationFrame=fn=>h3.browser.setTimeout(fn,0);globalThis.cancelAnimationFrame=id=>h3.browser.clearTimeout(id);
    h3.mount(()=>useDraftRecovery('story-1',{title:'نسخة أحدث من الخادم',excerpt:'',body:''},{version:5}));await h3.tick(0);
    assert.equal(h3.value.recovery.title,'كتابة محلية');
    assert.deepEqual(h3.value.recoveryMeta,{stale:true,storedVersion:4,storedUpdatedAt:'2026-09-09T10:00:00.000Z',currentVersion:5,at:record.at});
    // clear بعد النشر يمسح النسخة ولا يكتبها عند فك المحرر
    h3.value.clear(); h3.render(); assert.equal(h3.storage.has('story-1'),false); h3.unmount(); assert.equal(h3.storage.has('story-1'),false);

    // مهلة السبعة أيام: ما بعدها يُسقط
    const h4=harness(); globalThis.__draftHooks=h4.hooks; globalThis.window=h4.browser; h4.storage.set('story-1',h.storage.get('story-1'));
    globalThis.localStorage={getItem:k=>h4.storage.get(k)??null,setItem:(k,v)=>h4.storage.set(k,v),removeItem:k=>h4.storage.delete(k)};
    globalThis.requestAnimationFrame=fn=>h4.browser.setTimeout(fn,0);globalThis.cancelAnimationFrame=id=>h4.browser.clearTimeout(id);
    clock=record.at+7*86400_000-1;
    h4.mount(()=>useDraftRecovery('story-1',{title:'أصل',excerpt:'',body:''},{version:4}));await h4.tick(0);
    assert.equal(h4.value.recovery.title,'كتابة محلية','قبل انقضاء المهلة بلحظة تُعرض'); h4.unmount();
    const h5=harness(); globalThis.__draftHooks=h5.hooks; globalThis.window=h5.browser; h5.storage.set('story-1',h.storage.get('story-1'));
    globalThis.localStorage={getItem:k=>h5.storage.get(k)??null,setItem:(k,v)=>h5.storage.set(k,v),removeItem:k=>h5.storage.delete(k)};
    globalThis.requestAnimationFrame=fn=>h5.browser.setTimeout(fn,0);globalThis.cancelAnimationFrame=id=>h5.browser.clearTimeout(id);
    clock=record.at+7*86400_000;
    h5.mount(()=>useDraftRecovery('story-1',{title:'أصل',excerpt:'',body:''},{version:4}));await h5.tick(0);
    assert.equal(h5.value.recovery,null); assert.equal(h5.storage.has('story-1'),false,'المنتهية تُحذف'); h5.unmount();
  }finally{Object.assign(globalThis,originals);delete globalThis.__draftHooks;await rm(dir,{recursive:true,force:true})}
});

test('new stories get a per-tab token so two "new" tabs do not overwrite each other',async()=>{
  await mkdir(`${process.cwd()}/tmp`,{recursive:true});
  const dir=await mkdtemp(`${process.cwd()}/tmp/recovery-tab-`);
  const originals={sessionStorage:globalThis.sessionStorage};
  const h=harness(); globalThis.__draftHooks=h.hooks;
  try{
    const {useDraftTabToken}=await load(dir);
    // بلا sessionStorage (رندر الخادم): يسقط إلى «new» ولا يرمي
    delete globalThis.sessionStorage;
    h.mount(()=>useDraftTabToken()); assert.equal(h.value,'new');
    // تبويب أول
    const tabA=new Map(); globalThis.sessionStorage={getItem:k=>tabA.get(k)??null,setItem:(k,v)=>tabA.set(k,v)};
    const hA=harness(); globalThis.__draftHooks=hA.hooks; hA.mount(()=>useDraftTabToken());
    assert.match(hA.value,/^tahrir:draft-tab:[0-9a-f-]{36}$/); assert.equal(tabA.get('tahrir:draft-tab'),hA.value);
    // إعادة تحميل التبويب نفسه تعيد الرمز نفسه
    const hA2=harness(); globalThis.__draftHooks=hA2.hooks; hA2.mount(()=>useDraftTabToken()); assert.equal(hA2.value,hA.value);
    // تبويب ثانٍ بمخزن جلسة مستقل يحصل على رمز مختلف
    const tabB=new Map(); globalThis.sessionStorage={getItem:k=>tabB.get(k)??null,setItem:(k,v)=>tabB.set(k,v)};
    const hB=harness(); globalThis.__draftHooks=hB.hooks; hB.mount(()=>useDraftTabToken());
    assert.notEqual(hB.value,hA.value);
    // التخزين الممنوع لا يعطل المحرر
    globalThis.sessionStorage={getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')}};
    const hC=harness(); globalThis.__draftHooks=hC.hooks; hC.mount(()=>useDraftTabToken()); assert.equal(hC.value,'new');
  }finally{ if(originals.sessionStorage===undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage=originals.sessionStorage; delete globalThis.__draftHooks;await rm(dir,{recursive:true,force:true})}
});
