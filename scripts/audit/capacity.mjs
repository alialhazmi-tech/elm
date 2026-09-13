import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function capacityTarget(value, stagingHost) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Use a plain HTTP(S) origin');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.hostname === 'alelm.net' || url.hostname.endsWith('.alelm.net') || url.hostname === 'elm-production-ea24.up.railway.app') throw Error('Production load testing is prohibited');
  if (!local && (!stagingHost || stagingHost !== url.hostname || url.protocol !== 'https:')) throw Error('Set LOAD_STAGING_HOST to the exact authorized staging hostname');
  return url.origin;
}
export function classifyResponse(response, expectedType) {
  if (response.headers.get('cf-mitigated') === 'challenge') return 'challenge';
  if (response.status >= 500) return 'server_error';
  if (response.status >= 400) return 'client_error';
  if (response.status >= 300) return 'redirect';
  if (expectedType && !response.headers.get('content-type')?.includes(expectedType)) return 'unexpected_content';
  return 'ok';
}
export async function measureStage({ origin, paths, concurrency, durationMs, fetchImpl = fetch }) {
  const results = [], stopAt = performance.now() + durationMs;
  let stop = false;
  await Promise.all(Array.from({length:concurrency}, async () => {
    let index = 0;
    while (!stop && performance.now() < stopAt) {
      const item = paths[index++ % paths.length];
      const start = performance.now();
      let outcome;
      try {
        const response = await fetchImpl(new URL(item.path, origin), {redirect:'manual',signal:AbortSignal.timeout(15000)});
        outcome = classifyResponse(response,item.type);
        await response.arrayBuffer();
      } catch(error) { outcome = error.name === 'TimeoutError' ? 'timeout' : 'network_error'; }
      results.push({outcome,ms:performance.now()-start});
      if(results.length >= 20 && results.filter(r=>r.outcome!=='ok').length/results.length > 0.1) stop=true;
      // A bounded read workload, with a pause between requests per virtual user.
      await new Promise(resolve=>setTimeout(resolve,100));
    }
  }));
  const times=results.map(r=>r.ms).sort((a,b)=>a-b);
  const counts=Object.fromEntries([...new Set(results.map(r=>r.outcome))].map(k=>[k,results.filter(r=>r.outcome===k).length]));
  return {concurrency,requests:results.length,counts,p50Ms:times[Math.floor((times.length-1)*.5)]??null,p95Ms:times[Math.ceil((times.length-1)*.95)]??null,stoppedEarly:stop};
}
async function main() {
  const origin=capacityTarget(process.env.LOAD_ORIGIN??'',process.env.LOAD_STAGING_HOST);
  const stages=(process.env.LOAD_STAGES??'1,5,10').split(',').map(Number);
  const seconds=Number(process.env.LOAD_STAGE_SECONDS??10);
  if(stages.some(n=>!Number.isInteger(n)||n<1||n>200)||stages.length>10||!Number.isInteger(seconds)||seconds<1||seconds>60)throw Error('Invalid bounded stages');
  const paths=JSON.parse(process.env.LOAD_PATHS??'[{"path":"/","type":"text/html"}]');
  if(!Array.isArray(paths)||!paths.length||paths.some(p=>typeof p.path!=='string'||!p.path.startsWith('/')||p.path.startsWith('//')||new URL(p.path,origin).origin!==origin||p.path.includes('\\')))throw Error('Paths must remain on the authorized origin');
  const report={at:new Date().toISOString(),origin,method:'GET, manual redirects, 100ms pause per virtual user; no writes or authentication',stages:[]};
  for(const concurrency of stages){const result=await measureStage({origin,paths,concurrency,durationMs:seconds*1000});report.stages.push(result);console.log(JSON.stringify(result));if(result.stoppedEarly)break;}
  if(process.env.LOAD_OUTPUT)await writeFile(process.env.LOAD_OUTPUT,JSON.stringify(report,null,2));
  if(report.stages.some(s=>s.stoppedEarly||Object.keys(s.counts).some(k=>k!=='ok')))process.exitCode=1;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1});
