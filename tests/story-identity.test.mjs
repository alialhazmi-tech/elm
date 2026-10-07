import assert from 'node:assert/strict';
import test from 'node:test';
import { stableIdentity } from '../lib/tahrir/write-policy.ts';
const id='12345678-abcd-4444-8888-123456789012';
test('unpublished titles produce descriptive slugs; published slugs never change but sections stay correctable',()=>{
 assert.equal(stableIdentity(null,{title:'اقتصاد المملكة: نمو جديد',section:'economy'},id).slug,'اقتصاد-المملكة-نمو-جديد');
 assert.equal(stableIdentity(null,{title:'عنوان مكتمل',slug:'story-12345678'},id).slug,'عنوان-مكتمل');
 assert.equal(stableIdentity(null,{title:'آخر',slug:'رابط-اختاره-المحرر'},id).slug,'رابط-اختاره-المحرر');
 assert.equal(stableIdentity(null,{title:'...'},id).slug,'story-12345678');
 assert.equal(stableIdentity(null,{title:'الذكاء الاصطناعي يشعل خلافًا مع المسيّرات'},id).slug,'الذكاء-الاصطناعي-يشعل-خلافا-مع-المسيرات');
 const published={slug:'story-12345678',section:'politics'};
 assert.deepEqual(stableIdentity(published,{title:'جديد',slug:'تغيير',section:'economy'},id),{slug:'story-12345678',section:'economy'});
 assert.deepEqual(stableIdentity(published,{title:'جديد',slug:'تغيير'},id),published);
 assert.deepEqual(stableIdentity(published,{title:'جديد',section:'  '},id),published);
});
