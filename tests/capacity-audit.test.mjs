import assert from 'node:assert/strict';
import test from 'node:test';
import { capacityTarget, classifyResponse } from '../scripts/audit/capacity.mjs';
test('capacity tests refuse production, redirects and credentials; staging must be explicitly identified',()=>{
 for(const value of ['https://alelm.net','https://www.alelm.net','https://elm-production-ea24.up.railway.app'])assert.throws(()=>capacityTarget(value,new URL(value).hostname));
 assert.throws(()=>capacityTarget('https://example.org'));assert.throws(()=>capacityTarget('https://user:secret@staging.invalid','staging.invalid'));
 assert.equal(capacityTarget('http://127.0.0.1:3138'),'http://127.0.0.1:3138');assert.equal(capacityTarget('https://staging.invalid','staging.invalid'),'https://staging.invalid');
});
test('Cloudflare challenges are distinct from origin failures, redirects and wrong response types',()=>{
 assert.equal(classifyResponse(new Response('challenge',{status:403,headers:{'cf-mitigated':'challenge'}})),'challenge');
 assert.equal(classifyResponse(new Response('',{status:503})),'server_error');assert.equal(classifyResponse(new Response('',{status:308})),'redirect');
 assert.equal(classifyResponse(new Response('<html>',{headers:{'content-type':'text/html'}}),'application/json'),'unexpected_content');
});
