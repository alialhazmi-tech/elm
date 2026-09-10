import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
const result = await build({entryPoints:['lib/mobile/home-presentation.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {homePresentationExclusions,toMobileHomePresentation} = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const story = id => ({id,slug:`story-${id}`,section:'health',title:`مادة ${id}`,excerpt:'شرح منشور',eyebrow:'أبسط',readingMinutes:2,series:'absat',image:'/uploads/image.jpg',body:'متن لا يجب نقله'});
const home = {
  hero:story('hero'),brief:Array.from({length:5},(_,i)=>({title:`عنوان ${i}`,href:`/health/b${i}/story`,label:'أبسط',color:'#2d9a8c'})),
  briefFrom:5000,mosaic:[story('context')],mostRead:[story('duplicate'),story('archive')],
  series:[{slug:'absat',name:'أبسط',description:'شرح المعقد',color:'#2d9a8c'}],
};
const stream = {
  river:[story('river')],panels:[{slug:'health',name:'صحة',color:'#2d9a8c',lead:story('lead'),rows:[story('duplicate')],todayCount:2}],
  infographics:[story('graphic')],pulse:{todayCount:5,lastAt:null,hours:[],nowMs:0,nowHour:0},
};
test('mobile selection excludes web hero/context/archive and preserves ordered editorial sections',()=>{
  assert.deepEqual([...homePresentationExclusions(home)],['hero','context','duplicate','archive']);
  const p=toMobileHomePresentation(home,stream,{absat:{count:5047,latest:story('latest')}},[{title:'آخر خبر',href:'/news/x/story',urgent:false}],'https://alelm.net');
  assert.equal(p.seriesDirectory[0].count,5047); // full directory count, not capped feed length
  assert.equal(p.seriesDirectory[0].latest.id,'latest');
  assert.deepEqual(p.stream.panels.map(x=>x.slug),['health']);
  assert.deepEqual(p.archive.map(x=>x.id),['archive']);
  assert.equal(p.briefFrom,5000);
  for(const item of home.brief) assert.ok(p.briefScript.includes(item.title));
  assert.equal(p.newsStrip[0].urgent,false);
});
test('all added cards retain canonical routes, absolute images and omit article bodies',()=>{
  const p=toMobileHomePresentation(home,stream,{},[],'https://alelm.net');
  for(const card of [...p.stream.river,p.stream.panels[0].lead,...p.stream.panels[0].rows,...p.stream.infographics,...p.archive]) {
    assert.equal(card.href,`/health/${card.id}/story-${card.id}`);
    assert.equal(card.image,'https://alelm.net/uploads/image.jpg');
    assert.equal('body' in card,false);
  }
});
test('optional stream failure keeps the brief, series and archive available',()=>{
  const p=toMobileHomePresentation(home,null,{},[],'https://alelm.net');
  assert.equal(p.stream,null);
  assert.deepEqual(p.archive.map(x=>x.id),['duplicate','archive']);
  assert.equal(p.seriesDirectory[0].count,0);
  assert.equal(p.seriesDirectory[0].latest,null);
  assert.ok(p.briefScript.length>0);
  assert.deepEqual(homePresentationExclusions({...home,hero:null}),new Set(['context','duplicate','archive']));
});
