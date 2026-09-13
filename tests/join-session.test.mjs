import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {build} from 'esbuild';

test('join redirects active editors on reload and preserves member onboarding, next and suspension',async()=>{
  await mkdir('tmp',{recursive:true});const dir=await mkdtemp(`${process.cwd()}/tmp/join-session-`);
  const fixture={member:null,editor:null,suspended:false,completed:true,configured:true};globalThis.__joinSession=fixture;
  try{
    await build({entryPoints:['app/join/page.tsx'],outfile:`${dir}/page.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',plugins:[{name:'session',setup(b){
      const mocks={
        '@/lib/membership/auth':'export const memberAuthConfigured=true;',
        '@/lib/membership/session':'export const getMemberSession=async()=>({data:globalThis.__joinSession.member?{user:globalThis.__joinSession.member}:null,suspended:globalThis.__joinSession.suspended});',
        '@/lib/membership/profile':'export const getMemberProfile=async()=>({onboardingCompleted:globalThis.__joinSession.completed});',
        '@/lib/tahrir/access':'export const loadActor=async()=>globalThis.__joinSession.editor;',
        '@/app/account/actions':'export const signOutMember=async()=>{};',
        '@/app/_components/site-chrome':'export const SiteHeader=()=>null,SiteFooter=()=>null;',
        './join-form':'export const JoinForm=()=>null;',
        'next/navigation':'export const redirect=location=>{throw Object.assign(new Error("redirect"),{location})};',
        'next/link':'export default "a";',
      };
      b.onResolve({filter:/\.css$/},()=>({path:'empty',namespace:'fixture'}));
      b.onResolve({filter:/.*/},({path})=>path in mocks?{path,namespace:'fixture'}:undefined);
      b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:mocks[path]??'',loader:'js'}));
    }}]});
    const {default:Page}=await import(`${dir}/page.mjs`);const page=(next,mode)=>Page({searchParams:Promise.resolve({next,mode})});
    assert.ok(await page());
    fixture.editor={userId:'editor'};
    for(const mode of ['signin','signup','forgot'])for(const next of [undefined,'/account','/welcome','https://evil.invalid'])await assert.rejects(page(next,mode),e=>e.location==='/');
    fixture.member={id:'reader'};
    await assert.rejects(page('/for-you'),e=>e.location==='/for-you');
    fixture.completed=false;await assert.rejects(page(),e=>e.location==='/welcome');
    fixture.suspended=true;assert.ok(await page());
    fixture.suspended=false;fixture.member=null;fixture.editor=null;assert.ok(await page());
  }finally{delete globalThis.__joinSession;await rm(dir,{recursive:true,force:true});}
});

test('returning from an admin tab makes the real header hide join form and refresh its server guard',async()=>{
  await mkdir('tmp',{recursive:true});const dir=await mkdtemp(`${process.cwd()}/tmp/join-focus-`);
  const original={fetch:globalThis.fetch,window:globalThis.window,document:globalThis.document};
  const effects=[],states=[],refs=[];let stateCursor=0,refCursor=0;let viewer={member:null,editor:null};let refreshes=0;
  const fixture={useState:v=>{const i=stateCursor++;if(!(i in states))states[i]=v;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]},useRef:v=>{const i=refCursor++;return refs[i]??={current:v}},useEffect:f=>effects.push(f),useActionState:()=>[{},()=>{},false],useSyncExternalStore:(subscribe,get)=>get(),router:{refresh:()=>refreshes++,push:()=>{}},params:new URLSearchParams()};
  globalThis.__joinFocus=fixture;globalThis.window=Object.assign(new EventTarget(),{setInterval,clearInterval});globalThis.document=new EventTarget();globalThis.fetch=async()=>Response.json(viewer);
  try{
    await build({stdin:{contents:"export {MemberEntry} from './app/_components/member-entry';export {JoinForm} from './app/join/join-form';export {memberSessionStore} from './lib/membership/client-session';",resolveDir:process.cwd(),loader:'ts'},outfile:`${dir}/subject.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',plugins:[{name:'browser-fixture',setup(b){
      const mocks={react:'export const {useState,useRef,useEffect,useActionState,useSyncExternalStore}=globalThis.__joinFocus;',
        'next/navigation':'export const useRouter=()=>globalThis.__joinFocus.router;export const usePathname=()=>"/join";export const useSearchParams=()=>globalThis.__joinFocus.params;',
        'next/link':'export default "a";',
        '@/components/profile-avatar':'export const ProfileAvatar=()=>null;',
        '@/app/account/actions':'export const endMemberSession=async()=>({success:true});',
        './actions':'export const requestMemberPasswordReset=async()=>({}),signInMember=async()=>({}),signUpMember=async()=>({});'};
      b.onResolve({filter:/.*/},({path})=>path in mocks?{path,namespace:'fixture'}:undefined);
      b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:mocks[path],loader:'js'}));
    }}]});
    const {MemberEntry,JoinForm,memberSessionStore}=await import(`${dir}/subject.mjs`);
    MemberEntry({});const cleanups=effects.splice(0).map(f=>f());await new Promise(r=>setTimeout(r,0));assert.equal(memberSessionStore.getSnapshot(),false);
    viewer={member:null,editor:{name:'الإدارة'}};window.dispatchEvent(new Event('focus'));await new Promise(r=>setTimeout(r,0));assert.equal(memberSessionStore.getSnapshot(),true);
    const content=JoinForm({available:true});assert.match(JSON.stringify(content),/أنت مسجّل الدخول/);assert.doesNotMatch(JSON.stringify(content),/member-form-head/);effects.splice(0).forEach(f=>f());assert.equal(refreshes,1);
    viewer={member:null,editor:null};window.dispatchEvent(new Event('focus'));await new Promise(r=>setTimeout(r,0));assert.equal(memberSessionStore.getSnapshot(),false);
    viewer={member:{name:'قارئ',emailVerified:true},editor:null};window.dispatchEvent(new Event('focus'));await new Promise(r=>setTimeout(r,0));assert.equal(memberSessionStore.getSnapshot(),true);
    cleanups.forEach(f=>f?.());
  }finally{Object.assign(globalThis,original);delete globalThis.__joinFocus;await rm(dir,{recursive:true,force:true});}
});
