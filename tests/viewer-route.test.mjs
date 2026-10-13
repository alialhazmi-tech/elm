import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { createAuthServer, NEON_AUTH_SESSION_COOKIE_NAME } from '@neondatabase/auth/server';
import { createSessionToken } from '../lib/tahrir/crypto.ts';

// Bundle the real route, member guard, editor guard, and SDK; replace only request
// context, transport, and storage. No production account or secret is used.
test('viewer distinguishes absence, revocation and dependency failure without leaking identity', async () => {
  await mkdir('tmp', {recursive:true});
  const dir=await mkdtemp(`${process.cwd()}/tmp/viewer-route-`);
  const originalFetch=globalThis.fetch, originalError=console.error, oldSecret=process.env.AUTH_SECRET;
  process.env.AUTH_SECRET='viewer-fixture-signing-secret-only';
  const jar=new Map(), logs=[];
  let upstreamCalls=0, databaseCalls=0, providerStatus=200, providerBody=null, dbFailure=false, databaseAvailable=true;
  const member={id:'member-fixture',name:'قارئ',email:'private@example.invalid',emailVerified:true};
  const editor={id:'editor-fixture',username:'editor',displayName:'محرر',avatarUrl:null,role:'editor',sessionVersion:1,status:'active'};
  let profileStatus='active';
  const fixture={jar,db:null,auth:null};
  fixture.db={select:()=>({from(table){
    databaseCalls++;
    const execute=async()=>{
      if(dbFailure) throw Object.assign(new Error('secret SQL cookie token private@example.invalid'),{code:'ECONNRESET'});
      if(table===fixture.schema.memberProfiles) return [{status:profileStatus,avatarUrl:null}];
      if(table===fixture.schema.users) return [editor];
      if(table===fixture.schema.roles) return [{id:'editor',label:'محرر',description:'',isSystem:1,position:1}];
      if(table===fixture.schema.rolePermissions) return [{roleId:'editor',permissionKey:'story.edit.own'}];
      return [];
    };
    const query={where:()=>query,limit:execute,then:(resolve,reject)=>execute().then(resolve,reject)};
    return query;
  }})};
  fixture.getDb=()=>databaseAvailable?fixture.db:null;
  fixture.auth=createAuthServer({baseUrl:'https://viewer-auth.example.invalid',cookieSecret:'viewer-fixture-cookie-secret-32-characters',context:async()=>({getCookies:()=>[...jar].map(([k,v])=>`${k}=${v}`).join('; '),setCookie:(k,v)=>jar.set(k,v),getHeader:()=>null,getOrigin:()=>'',getFramework:()=> 'nextjs'})});
  globalThis.__viewerRouteFixture=fixture;
  globalThis.fetch=async()=>{upstreamCalls++;return Response.json(providerBody,{status:providerStatus});};
  console.error=value=>logs.push(JSON.parse(value));
  try {
    await build({stdin:{contents:"export {GET} from './app/api/viewer/route';export {loadActor,requirePermission,invalidateRoleCache} from './lib/tahrir/access';export * as schema from './db/schema';",resolveDir:process.cwd(),loader:'ts'},outfile:`${dir}/subject.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'viewer-fixture',setup(b){
      const mocks={
        'next/server':'export {NextResponse} from "next/server.js";',
        '@/lib/membership/auth':'export const memberAuthConfigured=true;export const memberAuth=globalThis.__viewerRouteFixture.auth;',
        '@/lib/db':'export const getDb=()=>globalThis.__viewerRouteFixture.getDb();',
        'next/headers':'export const cookies=async()=>({get:name=>({value:globalThis.__viewerRouteFixture.jar.get(name)})});',
      };
      b.onResolve({filter:/.*/},({path})=>path in mocks?{path,namespace:'fixture'}:undefined);
      b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:mocks[path],loader:'js',resolveDir:process.cwd()}));
    }}]});
    const subject=await import(`${dir}/subject.mjs`);fixture.schema=subject.schema;
    const request=async(status=200)=>{const response=await subject.GET();assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('x-request-id'),/^[a-f0-9-]{36}$/);return response;};
    providerStatus=429;providerBody={message:'Too many requests. secret cookie'};
    // Reproduce baseline: the real SDK contacts the provider with no session token.
    assert.equal((await fixture.auth.getSession()).error.status,429);
    upstreamCalls=0;
    assert.deepEqual(await (await request()).json(),{member:null,editor:null});
    assert.equal(upstreamCalls,0);assert.equal(databaseCalls,0);
    jar.set('unrelated', 'contains __Secure-neon-auth.session_token');
    await request();assert.equal(upstreamCalls,0,'substring matches do not establish a session');
    jar.set(NEON_AUTH_SESSION_COOKIE_NAME,'synthetic-session-token');
    let failed=await request(503);
    assert.equal(logs.at(-1).status,429);assert.equal(logs.at(-1).operation,'member.session');
    assert.equal(logs.at(-1).requestId,failed.headers.get('x-request-id'));
    for(const status of [401,403,500,503]) {providerStatus=status;await request(503);}
    providerStatus=200;providerBody=null;
    assert.deepEqual(await (await request()).json(),{member:null,editor:null},'expired provider session is a confirmed guest');
    providerBody={user:member,session:{id:'session',userId:member.id}};
    assert.deepEqual(await (await request()).json(),{member:{name:'قارئ',image:null,emailVerified:true},editor:null});
    profileStatus='suspended';assert.equal((await (await request()).json()).member,null);profileStatus='active';
    databaseAvailable=false;await request(503);assert.equal(logs.at(-1).operation,'member.profile');assert.equal(logs.at(-1).code,'STORAGE_UNAVAILABLE');databaseAvailable=true;
    dbFailure=true;await request(503);assert.equal(logs.at(-1).operation,'member.profile');assert.equal(logs.at(-1).code,'ECONNRESET');dbFailure=false;
    globalThis.fetch=async()=>{throw new TypeError('fetch failed', {cause:Object.assign(new Error('private DSN'),{code:'ECONNRESET'})});};
    await request(503);assert.equal(logs.at(-1).operation,'member.session');
    jar.clear();
    const token=await createSessionToken({userId:editor.id,username:editor.username,displayName:editor.displayName,role:'admin',sessionVersion:1});
    jar.set('alelm_tahrir',token);
    assert.equal((await (await request()).json()).editor.name,'محرر');
    const actor=await subject.loadActor();assert.equal(actor.can('story.edit.own'),true);assert.equal(actor.can('users.manage'),false,'signed role cannot override live permissions');
    assert.equal((await subject.requirePermission('users.manage')).response.status,403);
    editor.status='suspended';assert.equal((await (await request()).json()).editor,null);editor.status='active';
    editor.sessionVersion=2;assert.equal((await (await request()).json()).editor,null);editor.sessionVersion=1;
    jar.set('alelm_tahrir','invalid-token');assert.equal((await (await request()).json()).editor,null);
    const now=Date.now;let expiredToken;try{Date.now=()=>now()-13*3600000;expiredToken=await createSessionToken({userId:editor.id,username:editor.username,displayName:editor.displayName,role:'editor',sessionVersion:1});}finally{Date.now=now;}
    jar.set('alelm_tahrir',expiredToken);assert.equal((await (await request()).json()).editor,null,'expired editor token is anonymous');
    jar.set('alelm_tahrir',token);
    databaseAvailable=false;await request(503);assert.equal(logs.at(-1).operation,'editor.profile');databaseAvailable=true;
    dbFailure=true;await request(503);assert.ok(logs.at(-1).operation.startsWith('editor.'));
    const output=JSON.stringify(logs);
    for(const value of ['secret','cookie','token','private@example.invalid','private DSN','قارئ','محرر','synthetic-session']) assert.equal(output.includes(value),false);
    assert.ok(logs.every(log=>Object.keys(log).every(key=>['event','requestId','dependency','operation','status','code','durationMs'].includes(key))));
  } finally {
    globalThis.fetch=originalFetch;console.error=originalError;
    if(oldSecret===undefined) delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=oldSecret;
    delete globalThis.__viewerRouteFixture;await rm(dir,{recursive:true,force:true});
  }
});

test('diagnostics unwrap known storage codes and discard arbitrary exception metadata',async()=>{
 const {SessionReadError}=await import('../lib/session-diagnostics.ts');
 const wrapped=new SessionReadError('member.profile',new Error('SQL containing secrets',{cause:{code:'53300',message:'private DSN'}}));
 assert.equal(wrapped.code,'53300');
 const unknown=new SessionReadError('member.session',{status:'429',code:'private@example.invalid',token:'secret'});
 assert.equal(unknown.status,undefined);assert.equal(unknown.code,undefined);
 assert.doesNotMatch(JSON.stringify(wrapped)+JSON.stringify(unknown),/secret|SQL|private|token/);
});
