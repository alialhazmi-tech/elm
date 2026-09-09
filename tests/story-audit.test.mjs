import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldChanges } from '../lib/tahrir/story-audit.ts';

test('audit keeps clearing, status, metadata and unknown-field boundaries', () => {
  const changes=fieldChanges({title:'قديم',image:'/old.jpg',status:'draft',pinned:1},{title:'جديد',image:null,status:'scheduled',pinned:0,seoTitle:'عنوان البحث',updatedAt:'now',passwordHash:'never'});
  assert.deepEqual(changes.map(x=>x.field),['title','image','status','pinned','seoTitle']);
  assert.equal(changes.find(x=>x.field==='image').before,'/old.jpg');
  assert.equal(changes.find(x=>x.field==='image').after,null);
  assert.deepEqual(fieldChanges({title:'نفسه'},{title:'نفسه'}),[]);
});
test('long changes preserve every edit without repeating shared text or splitting emoji', () => {
  const pairs=[['أ'.repeat(600)+'قديم🟢ذيل','أ'.repeat(600)+'جديد🟡ذيل'],['ن'.repeat(600)+'😀','ن'.repeat(600)+'😁'],['ن'.repeat(600)+'😀آخر','ن'.repeat(600)+'أآخر'],['x'.repeat(600),''],['','x'.repeat(600)]];
  for(const [before,after] of pairs){const [change]=fieldChanges({body:before},{body:after});
    const delta=change.text; assert.ok(delta);
    const reconstructed=before.slice(0,delta.offset)+delta.added+before.slice(delta.offset+delta.removed.length);
    assert.equal(reconstructed,after); assert.equal(delta.added.isWellFormed(),true);assert.equal(delta.removed.isWellFormed(),true);
  }
});
