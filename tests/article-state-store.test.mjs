import assert from 'node:assert/strict';
import test from 'node:test';
import { createArticleStateStore, EMPTY_ARTICLE_STATE } from '../lib/personalization/article-state-store.ts';
const member = id => ({...EMPTY_ARTICLE_STATE, memberId:id, saveOwnerId:id, signedIn:true, saved:false, status:'ready'});
test('three article consumers share one request, save updates and no persistent cache after disposal',async()=>{
 let calls=0; const store=createArticleStateStore(async()=>{calls++;return member('first')});
 let updates=0;const remove=store.subscribe(()=>updates++);
 const values=await Promise.all([store.refresh(),store.refresh(),store.refresh()]);
 assert.equal(calls,1);assert.ok(values.every(v=>v.memberId==='first'));
 store.setState(s=>({...s,saved:true}));assert.equal(store.getSnapshot().saved,true);assert.ok(updates>0);
 remove();store.dispose();assert.equal(store.getSnapshot(),EMPTY_ARTICLE_STATE);
 await store.refresh();assert.equal(calls,2);
});
test('account invalidation aborts and rejects late previous-session responses',async()=>{
 const requests=[];const store=createArticleStateStore(signal=>new Promise(resolve=>requests.push({signal,resolve})));
 const first=store.refresh();await Promise.resolve();
 const second=store.refresh(true);await Promise.resolve();
 assert.equal(requests[0].signal.aborted,true);assert.equal(store.getSnapshot().saveOwnerId,null);
 requests[1].resolve(member('new'));await second;requests[0].resolve(member('old'));assert.equal(await first,null);
 assert.equal(store.getSnapshot().memberId,'new');
});
test('failed verification clears privileges and can retry; disposed response cannot restore them',async()=>{
 let fail=false;const store=createArticleStateStore(async()=>{if(fail)throw Error('offline');return member('reader')});
 await store.refresh();fail=true;await store.refresh(true);assert.equal(store.getSnapshot().status,'error');assert.equal(store.getSnapshot().signedIn,false);
 fail=false;await store.refresh();assert.equal(store.getSnapshot().status,'ready');
 let resolve;const late=createArticleStateStore(()=>new Promise(r=>resolve=r));const pending=late.refresh();await Promise.resolve();late.dispose();resolve(member('old'));await pending;assert.equal(late.getSnapshot(),EMPTY_ARTICLE_STATE);
});
