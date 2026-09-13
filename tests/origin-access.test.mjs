import assert from 'node:assert/strict';
import test from 'node:test';
import { originAccess } from '../lib/security/origin-access.ts';
const secret='origin-test-secret-32-characters-long';
const config={enforced:true,secret,cronSecret:'scheduler-test-secret'};
const request=(path='/',headers={},method='GET')=>({url:'https://alelm.net'+path,method,headers:new Headers(headers)});
test('all app/asset/API entry points reject direct and spoofed proxy headers',()=>{
 for(const path of ['/','/tahrir/login','/api/tahrir/login','/api/webhooks/neon-auth','/_next/static/chunk.js','/uploads/photo.jpg']){
  assert.equal(originAccess(request(path),config).status,403);
  assert.equal(originAccess(request(path,{'host':'localhost','x-forwarded-host':'alelm.net','x-forwarded-for':'127.0.0.1','cf-connecting-ip':'203.0.113.2','next-router-prefetch':'1'}),config).status,403);
 }
});
test('authenticated edge accepts canonical IP and refuses missing/forged token and invalid IP',()=>{
 const valid={'x-alelm-origin-token':secret,'cf-connecting-ip':'203.0.113.2','x-forwarded-for':'attacker'};
 assert.deepEqual(originAccess(request('/api/mobile/v1/home',valid),config),{allowed:true,status:200,clientIp:'203.0.113.2'});
 for(const token of ['wrong',secret+'x','']) assert.equal(originAccess(request('/',{...valid,'x-alelm-origin-token':token}),config).status,403);
 for(const ip of ['', '127.0.0.1, 203.0.113.2','spoof']) assert.equal(originAccess(request('/',{...valid,'cf-connecting-ip':ip}),config).status,403);
});
test('readiness and scheduler exceptions are method/path/credential bounded; bad setup fails closed',()=>{
 assert.equal(originAccess(request('/api/health'),config).allowed,true);
 assert.equal(originAccess(request('/api/health',{},'POST'),config).status,403);
 assert.equal(originAccess(request('/api/health/extra'),config).status,403);
 assert.equal(originAccess(request('/api/tahrir/tick',{authorization:'Bearer scheduler-test-secret'},'POST'),config).allowed,true);
 assert.equal(originAccess(request('/api/tahrir/login',{authorization:'Bearer scheduler-test-secret'},'POST'),config).status,403);
 assert.equal(originAccess(request('/api/tahrir/tick',{authorization:'Bearer wrong'},'POST'),config).status,403);
 assert.equal(originAccess(request(),{enforced:true,secret:'short'}).status,503);
 assert.equal(originAccess(request(),{enforced:false}).allowed,true);
});
