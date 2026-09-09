import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';

test('dashboard navigation redacts identities and measures delayed content without opening public telemetry to private routes', async () => {
  await mkdir('tmp', {recursive:true}); const dir=await mkdtemp('tmp/dashboard-nav-');
  try {
    await build({stdin:{contents:`export * from './lib/performance/protocol';export * from './lib/performance/navigation'; export * from './lib/tahrir/editorial-tour';`,resolveDir:process.cwd(),loader:'ts'},outfile:`${dir}/subject.mjs`,bundle:true,platform:'node',format:'esm'});
    const {dashboardPerformanceRoute:route,publicPerformanceRoute,performanceInput,createNavigationTracker,tourSteps}=await import(`${process.cwd()}/${dir}/subject.mjs`);
    assert.equal(tourSteps(['story.create','story.submit']).length,6);
    assert.equal(tourSteps(['story.create','story.submit'])[5].title,'أرسل المادة للمراجعة');
    assert.equal(tourSteps(['story.publish'])[5].title,'اعتمد وانشر بثقة');
    assert.ok(tourSteps([])[5].body.includes('بحسب صلاحيات'));
    assert.equal(route('/tahrir/editor/private-story?token=secret'),'/tahrir/editor/[id]');
    assert.equal(route('/tahrir/stories?q=private-title'),'/tahrir/stories');
    assert.equal(route('/tahrir/profile/private-name'),null);
    assert.equal(publicPerformanceRoute('/tahrir/stories'),null);
    let now=0;const events=[];const at=Date.now();
    const tracker=createNavigationTracker({routeFor:route,now:()=>now,wallTime:()=>at,id:()=> '12345678-1234-1234-1234-123456789012',report:event=>events.push(event),network:()=>({networkMs:900,ttfbMs:800})});
    assert.equal(tracker.start('/tahrir/editor/private-id?q=private-title','https://example.org/tahrir','https://example.org'),true);
    now=2100;tracker.commit('/tahrir/editor/private-id','q=private-title');
    assert.equal(events[0].value,2100);assert.equal(events[0].outcome,'complete');assert.equal(events[0].route,'/tahrir/editor/[id]');
    const input=[{...events[0],sample:'slow'}];
    assert.equal(performanceInput(input,at),null);assert.ok(performanceInput(input,at,route));
    assert.equal(performanceInput([{...input[0],route:'/tahrir/editor/private-id'}],at,route),null);
    assert.equal(JSON.stringify(events).includes('private'),false);
    tracker.start('/tahrir/stories','https://example.org/tahrir','https://example.org');
    now=2300;tracker.start('/tahrir/tasks','https://example.org/tahrir','https://example.org');
    assert.equal(events[1].outcome,'superseded');
    assert.equal(tracker.commit('/tahrir/stories',''),false);
    now=3000;assert.equal(tracker.commit('/tahrir/tasks',''),true);
    assert.equal(events[2].route,'/tahrir/tasks');
  } finally {await rm(dir,{recursive:true,force:true});}
});
