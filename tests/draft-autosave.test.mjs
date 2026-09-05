import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { build } from 'esbuild';

function harness() {
  const slots=[]; let index=0, dirty=false, component, value, now=0, serial=0;
  const effects=[]; const timers=new Map(); const storage=new Map(); const listeners=new Map();
  const hooks={
    useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],next=>{const v=typeof next==='function'?next(slots[i]):next;if(!Object.is(slots[i],v)){slots[i]=v;dirty=true}}]},
    useRef(initial){const i=index++;return slots[i]??=( {current:initial})},
    useEffect(fn,deps){const i=index++;const prev=slots[i];if(!prev||deps.some((d,j)=>!Object.is(d,prev.deps[j]))){slots[i]={deps,cleanup:prev?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=fn()})}},
    useEffectEvent(fn){const i=index++;slots[i]??={run:(...args)=>slots[i].fn(...args)};slots[i].fn=fn;return slots[i].run},
  };
  const browser={setTimeout(fn,delay){const id=++serial;timers.set(id,{at:now+delay,fn});return id},clearTimeout(id){timers.delete(id)},addEventListener(name,fn){listeners.set(name,fn)},removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name)}};
  function render(){do{dirty=false;index=0;value=component();while(effects.length)effects.shift()()}while(dirty);return value}
  return {hooks,browser,storage,listeners, render, unmount(){for(const slot of slots)slot?.cleanup?.()}, get value(){return value}, mount(fn){component=fn;return render()},
    async tick(ms){const end=now+ms;let due;while((due=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0])){now=due[1].at;timers.delete(due[0]);due[1].fn();await Promise.resolve();render()}now=end;await Promise.resolve();render()},
  };
}

test('autosave debounces, saves newer typing next, pauses failures and preserves recovery',async()=>{
  const dir=await mkdtemp(`${process.cwd()}/tmp/autosave-`);
  const originals={window:globalThis.window,localStorage:globalThis.localStorage,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  const h=harness(); globalThis.__draftHooks=h.hooks;globalThis.window=h.browser;
  globalThis.localStorage={getItem:k=>h.storage.get(k)??null,setItem:(k,v)=>h.storage.set(k,v),removeItem:k=>h.storage.delete(k)};
  globalThis.requestAnimationFrame=fn=>h.browser.setTimeout(fn,0);globalThis.cancelAnimationFrame=id=>h.browser.clearTimeout(id);
  try{
    await build({stdin:{contents:"export {useDraftAutosave} from './components/tahrir/use-draft-autosave'; export {useDraftRecovery} from './components/tahrir/use-draft-recovery';",loader:'ts',resolveDir:process.cwd()},outfile:`${dir}/hooks.mjs`,bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'hooks',setup(b){b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:'export const {useState,useRef,useEffect,useEffectEvent}=globalThis.__draftHooks'}))}}]});
    const {useDraftAutosave,useDraftRecovery}=await import(`${dir}/hooks.mjs`);
    let snapshot={title:'',slug:''}, enabled=true, key='new', calls=0, finish;
    h.mount(()=>{const recovery=useDraftRecovery(key,snapshot);const auto=useDraftAutosave({snapshot,enabled:enabled&&recovery.ready&&!recovery.recovery,onSave:()=>{calls++;const sent={...snapshot};return new Promise(resolve=>{finish=success=>{if(success){const confirmed={...sent,slug:'server-slug'};recovery.markSaved(confirmed);auto.markSaved(confirmed);snapshot={...snapshot,slug:'server-slug'};key='saved-id'}resolve(success?'saved-id':null)}})}});return{auto,recovery}});
    await h.tick(0);assert.equal(calls,0);
    snapshot={...snapshot,title:'أ'};h.render();await h.tick(1000);
    snapshot={...snapshot,title:'أ ب'};h.render();await h.tick(1999);assert.equal(calls,0);await h.tick(1);assert.equal(calls,1);
    snapshot={...snapshot,title:'أ ب ج'};h.render();await h.tick(5000);assert.equal(calls,1);
    finish(true);await h.tick(0);assert.equal(h.value.auto.dirty,true);assert.equal(h.value.recovery.recovery,null);
    await h.tick(2000);assert.equal(calls,2);finish(true);await h.tick(0);assert.equal(h.value.auto.dirty,false);
    await h.tick(5000);assert.equal(calls,2);assert.equal(h.storage.has('new'),false);assert.equal(h.storage.has('saved-id'),false);
    snapshot={...snapshot,title:'فشل اتصال'};h.render();await h.tick(2000);assert.equal(calls,3);finish(false);await h.tick(0);
    assert.equal(h.value.auto.state,'error');snapshot={...snapshot,title:'تعديل بعد الفشل'};h.render();await h.tick(10000);assert.equal(calls,3);
    h.listeners.get('pagehide')();assert.equal(JSON.parse(JSON.parse(h.storage.get(key)).value).title,'تعديل بعد الفشل');
    h.value.auto.markSaved(snapshot);h.value.recovery.markSaved(snapshot);h.render();await h.tick(0);
    enabled=false;snapshot={...snapshot,title:'سير اعتماد'};h.render();await h.tick(5000);assert.equal(calls,3);
    // A recovered local copy blocks autosave instead of overwriting either version.
    key='other-draft';h.storage.set(key,JSON.stringify({at:Date.now(),value:JSON.stringify({title:'نسخة محلية',slug:'other'})}));enabled=true;h.render();await h.tick(0);await h.tick(5000);
    assert.equal(calls,3);assert.equal(h.value.recovery.recovery.title,'نسخة محلية');
    h.unmount();assert.equal(JSON.parse(JSON.parse(h.storage.get(key)).value).title,'نسخة محلية');
    h.value.recovery.dismiss();h.render();snapshot={...snapshot,title:'آخر كتابة قبل التنقل'};h.render();h.unmount();
    assert.equal(JSON.parse(JSON.parse(h.storage.get(key)).value).title,'آخر كتابة قبل التنقل');
  }finally{Object.assign(globalThis,originals);delete globalThis.__draftHooks;await rm(dir,{recursive:true,force:true})}
});
