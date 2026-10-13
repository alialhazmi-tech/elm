import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {build} from 'esbuild';
import {renderToStaticMarkup} from 'react-dom/server';

test('keyword page emits the same visible and structured trail with URLs on every ancestor',async()=>{
 await mkdir('tmp',{recursive:true});const dir=await mkdtemp(`${process.cwd()}/tmp/keyword-crumbs-`);
 try {
  await build({entryPoints:['app/keywords/[keyword]/page.tsx'],outfile:`${dir}/page.mjs`,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'keyword-fixture',setup(b){
   const mocks={
    'next/link':'import {createElement} from "react";export default function Link(props){return createElement("a",props)}',
    'next/navigation':'export const notFound=()=>{throw new Error("not found")};export const permanentRedirect=()=>{throw new Error("redirect")};',
    '@/app/_components/site-chrome':'export const SiteFooter=()=>null;export const SiteHeader=()=>null;',
    '@/app/_components/story-card':'export const MosaicCard=()=>null;',
    '@/lib/content/provider':'export const pageByKeyword=async()=>({items:[],total:0,page:1,pageCount:1,from:0,to:0});',
   };
   b.onResolve({filter:/.*/},({path})=>path in mocks?{path,namespace:'fixture'}:undefined);
   b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:mocks[path],loader:'js',resolveDir:process.cwd()}));
  }}]});
  const {default:Page}=await import(`${dir}/page.mjs`);
  const html=renderToStaticMarkup(await Page({params:Promise.resolve({keyword:'الشاشات'}),searchParams:Promise.resolve({})}));
  const nav=html.match(/<nav class="public-breadcrumbs"[\s\S]*?<\/nav>/)[0];
  const schema=JSON.parse(nav.match(/<script[^>]*>(.*?)<\/script>/)[1]);
  assert.equal(schema['@type'],'BreadcrumbList');
  assert.deepEqual(schema.itemListElement.map(x=>x.name),['الرئيسية','الشاشات']);
  assert.ok(schema.itemListElement.slice(0,-1).every(x=>new URL(x.item).origin==='https://alelm.net'));
  assert.match(nav,/<a href="\/">الرئيسية<\/a>/);
  assert.match(nav,/<span aria-current="page">الشاشات<\/span>/);
  assert.doesNotMatch(nav,/الكلمات المفتاحية/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
