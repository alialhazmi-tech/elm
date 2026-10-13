// Install isolated tooling: npm install --prefix /tmp/alelm-audit-tools lighthouse@12.8.2
// AUDIT_TOOLS_DIR=/tmp/alelm-audit-tools CHROME_PATH=/path/to/chrome node scripts/audit-mobile-lighthouse.mjs LABEL URLS.json OUTDIR
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.AUDIT_TOOLS_DIR ?? '.', 'package.json'));
const {default:lighthouse}=await import(require.resolve('lighthouse'));
const {launch}=await import(require.resolve('chrome-launcher'));
import {mkdir, writeFile, readFile} from 'node:fs/promises';
const [label, manifest, output]=process.argv.slice(2);
await mkdir(output,{recursive:true});
const urls=JSON.parse(await readFile(manifest,'utf8'));
for(const [name,url] of Object.entries(urls)) for(let run=1;run<=3;run++) {
 const chrome=await launch({chromePath:process.env.CHROME_PATH,chromeFlags:['--headless','--no-sandbox']});
 try {
  const {lhr}=await lighthouse(url,{port:chrome.port,logLevel:'error',onlyCategories:['performance'],maxWaitForLoad:45000});
  const a=lhr.audits; const summary={label,name,run,url:lhr.finalDisplayedUrl,fetchTime:lhr.fetchTime,version:lhr.lighthouseVersion,environment:lhr.environment,settings:lhr.configSettings,warnings:lhr.runWarnings,error:lhr.runtimeError,score:lhr.categories.performance.score,metrics:a.metrics.details,element:a['largest-contentful-paint-element']?.details,breakdown:a['lcp-breakdown-insight']?.details,network:a['network-requests']?.details,unusedJS:a['unused-javascript']?.details,renderBlocking:a['render-blocking-resources']?.details};
  await writeFile(`${output}/${label}-${name}-${run}.json`,JSON.stringify(summary,null,2));
  if(run===3 && a['final-screenshot']?.details?.data) await writeFile(`${output}/${label}-${name}-mobile.jpg`,Buffer.from(a['final-screenshot'].details.data.split(',')[1],'base64'));
  console.log(label,name,run,summary.score,a['largest-contentful-paint'].numericValue);
 } finally {await chrome.kill();}
}
