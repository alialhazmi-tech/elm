import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { SignJWT } from 'jose';
import { createAuthServer, NEON_AUTH_SESSION_COOKIE_NAME, NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '@neondatabase/auth/server';

test('successful OTP clears stale Neon session data; account and viewer read verified state across requests and old tabs', async () => {
  const originalFetch = globalThis.fetch;
  const secret = 'isolated-verification-cookie-secret-32-characters';
  const date = new Date().toISOString();
  const user = { id: 'reader', email: 'reader@example.invalid', name: 'قارئ', emailVerified: false, createdAt: date, updatedAt: date };
  const session = { id: 'session', userId: user.id, expiresAt: new Date(Date.now()+3600000).toISOString(), createdAt: date, updatedAt: date };
  const stale = await new SignJWT({user:{...user},session}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuedAt().setExpirationTime('5m').setSubject(user.id).sign(new TextEncoder().encode(secret));
  const jar = new Map([[NEON_AUTH_SESSION_COOKIE_NAME,'isolated-token'],[NEON_AUTH_SESSION_DATA_COOKIE_NAME,stale]]);
  const calls = [], notices = [], invalidations = [];
  let fail = false, suspended = false;
  globalThis.__verificationFixture = { jar, notices, invalidations, db: { select:()=>({from:()=>({where:()=>({limit:async()=>[{status:suspended?'suspended':'active',avatarUrl:null}]})})}) } };
  const auth = createAuthServer({baseUrl:'https://auth.example.invalid',cookieSecret:secret,sessionDataTtl:300,context:async()=>({getCookies:()=>[...jar].map(([k,v])=>`${k}=${v}`).join('; '),setCookie:(k,v)=>jar.set(k,v),getHeader:()=>null,getOrigin:()=> 'https://example.invalid',getFramework:()=> 'nextjs'})});
  globalThis.__verificationFixture.auth = auth;
  globalThis.fetch = async (input, options) => {
    const url = new URL(input); assert.equal(url.origin,'https://auth.example.invalid'); calls.push(url);
    if(url.pathname.endsWith('/get-session')) return Response.json({user:{...user},session});
    assert.ok(url.pathname.endsWith('/email-otp/verify-email'));
    const body = JSON.parse(options.body); assert.equal(body.email,user.email);
    if(fail || body.otp!=='123456') return Response.json({message:'Invalid OTP'},{status:400});
    user.emailVerified=true;
    // Reproduce provider success without Set-Cookie: the SDK leaves its old signed cache intact.
    return Response.json({status:true,user:{...user}});
  };
  await mkdir('tmp',{recursive:true});const dir=await mkdtemp(`${process.cwd()}/tmp/verification-session-`);
  try {
    await build({stdin:{contents:"export {getMemberSession} from './lib/membership/session';export {verifyMemberEmail,sendMemberVerification} from './app/account/actions';export {GET as viewer} from './app/api/viewer/route';",resolveDir:process.cwd(),loader:'ts'},outfile:`${dir}/subject.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'isolated-auth',setup(b){
      const fixtures={
        '@/lib/membership/auth':'export const memberAuthConfigured=true;export const memberAuth=globalThis.__verificationFixture.auth;',
        '@/lib/db':'export const getDb=()=>globalThis.__verificationFixture.db;',
        '@/lib/tahrir/access':'export const loadActor=async()=>null;',
        '@/lib/membership/email/notifications':'export const notifyAccountChange=input=>globalThis.__verificationFixture.notices.push(input);',
        'next/headers':'export const cookies=async()=>({delete:name=>globalThis.__verificationFixture.jar.delete(name)});',
        'next/cache':'export const revalidatePath=path=>globalThis.__verificationFixture.invalidations.push(path);export const unstable_cache=f=>f;export const revalidateTag=()=>{};',
        'next/navigation':'export const redirect=path=>{throw new Error("REDIRECT:"+path)};',
      };
      b.onResolve({filter:/.*/},({path})=>path in fixtures?{path,namespace:'fixture'}:undefined);
      b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:fixtures[path],loader:'js'}));
    }}]});
    const subject=await import(`${dir}/subject.mjs`);
    const form = new FormData();form.set('otp','123456');form.set('email','attacker@example.invalid');
    assert.equal((await auth.getSession()).data.user.emailVerified,false);assert.equal(calls.length,0,'real SDK serves stale signed data without contacting identity provider');
    assert.equal((await subject.getMemberSession()).data.user.emailVerified,false);assert.equal(calls.at(-1).searchParams.get('disableCookieCache'),'true');
    fail=true;assert.ok((await subject.verifyMemberEmail({},form)).error);assert.equal(jar.get(NEON_AUTH_SESSION_DATA_COOKIE_NAME),stale);assert.equal(notices.length,0);
    fail=false;assert.ok((await subject.verifyMemberEmail({},form)).success);assert.equal(user.emailVerified,true);assert.equal(jar.has(NEON_AUTH_SESSION_DATA_COOKIE_NAME),false);assert.equal(jar.has(NEON_AUTH_SESSION_COOKIE_NAME),true);assert.equal(notices.length,1);assert.equal(notices[0].email,user.email);assert.ok(invalidations.includes('/account/verify-email'));
    assert.equal((await subject.getMemberSession()).data.user.emailVerified,true,'new request after following welcome email reads persisted verification');
    jar.set(NEON_AUTH_SESSION_DATA_COOKIE_NAME,stale);
    assert.equal((await auth.getSession()).data.user.emailVerified,false,'old browser can still carry its own stale cookie');
    assert.equal((await subject.getMemberSession()).data.user.emailVerified,true);
    const viewer=await subject.viewer();assert.equal(viewer.status,200);assert.equal((await viewer.json()).member.emailVerified,true);
    const before=calls.filter(url=>url.pathname.endsWith('/email-otp/verify-email')).length;
    assert.ok((await subject.verifyMemberEmail({},form)).success);assert.ok((await subject.sendMemberVerification()).success);assert.equal(notices.length,1);assert.equal(calls.filter(url=>url.pathname.endsWith('/email-otp/verify-email')).length,before,'verified members do not verify or send again');
    suspended=true;assert.equal((await subject.getMemberSession()).data,null);
    suspended=false;
    const fresh=await new SignJWT({user:{...user},session}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(secret));jar.set(NEON_AUTH_SESSION_DATA_COOKIE_NAME,fresh);
    const reads=calls.length;assert.equal((await subject.getMemberSession()).data.user.emailVerified,true);assert.equal(calls.length,reads,'verified cache retains its fast path');
    const getSession = auth.getSession;
    try {
      auth.getSession = async () => ({data:null,error:{status:503,message:'provider unavailable'}});
      assert.equal((await subject.viewer()).status,503,'provider errors are not successful anonymous responses');
      auth.getSession = async () => { throw new Error('network unavailable'); };
      assert.equal((await subject.viewer()).status,503);
      assert.equal((await subject.getMemberSession()).data,null,'other guards retain their fail-closed behavior');
      let sessionCalls=0;
      auth.getSession = async () => ++sessionCalls === 1 ? {data:{user:{...user,emailVerified:false},session},error:null} : {data:null,error:{status:502}};
      assert.equal((await subject.viewer()).status,503,'fresh verification lookup failure remains unavailable');
      auth.getSession = async () => ({data:null,error:null});
      const anonymous=await subject.viewer();assert.equal(anonymous.status,200);assert.deepEqual(await anonymous.json(),{member:null,editor:null});
    } finally { auth.getSession=getSession; }
  } finally {globalThis.fetch=originalFetch;delete globalThis.__verificationFixture;await rm(dir,{recursive:true,force:true});}
});
