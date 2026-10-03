import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { build } from "esbuild";

test("public reports return native HTML with sandbox isolation and preserve canonical aliases", async () => {
  const directory = await mkdtemp("tmp/jak-route-");
  try {
    await build({
      entryPoints: ["app/jak/[id]/[slug]/route.ts"], outfile: `${directory}/route.mjs`,
      bundle: true, platform: "node", format: "esm", packages: "external",
      plugins: [{ name: "report-fixture", setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/tahrir\/jak-reports$/ }, args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ loader: "js", contents: `
          export async function getPublishedJakReportByPublicId(id){
            return ['11111111-1111-4111-8111-111111111111','1'].includes(id) ? {
              id:'11111111-1111-4111-8111-111111111111',publicNumber:1,slug:'الفيفا-لعبة-المال',title:'الفيفا',status:'published',
              excerpt:'وصف التقرير',image:null,css:'body{color:navy}',html:'<main><h1>الفيفا</h1><p>النص الكامل موجود في الاستجابة الأصلية</p></main>',
              publishedAt:'2026-10-01T00:00:00Z',sourcePublishedAt:null,sourcePostId:null
            } : null;
          }`,
        }));
      } }],
    });
    const { GET, HEAD } = await import(`../${directory}/route.mjs`);
    const canonical = '/jak/1/' + encodeURIComponent('الفيفا-لعبة-المال');
    const query = '?utm_source=test&ref=%D8%A7%D9%84%D8%B9%D9%84%D9%85';
    const invoke = (method, id, slug) => method(new Request('https://alelm.net/jak/'+id+'/'+encodeURIComponent(slug)+query), {params:Promise.resolve({id,slug})});
    const hosting = await GET(new Request('https://preview.up.railway.app'+canonical), {params:Promise.resolve({id:'1',slug:'الفيفا-لعبة-المال'})});
    assert.equal(hosting.headers.get('x-robots-tag'),'noindex, nofollow','hosting aliases stay out of search');
    for (const method of [GET, HEAD]) {
      for (const slug of ['الفيفا-لعبة-المال',encodeURIComponent('الفيفا-لعبة-المال')]) {
        const response = await invoke(method,'1',slug);
        assert.equal(response.status,200);
        assert.match(response.headers.get('content-type'),/text\/html/);
        assert.equal(response.headers.get('x-robots-tag'),'index, follow');
        assert.equal(response.headers.get('vary'),'User-Agent');
        const policy=response.headers.get('content-security-policy');
        assert.match(policy,/sandbox allow-scripts/);
        assert.match(policy,/connect-src 'none'/);
        assert.doesNotMatch(policy,/allow-same-origin|unsafe-eval|allow-forms/);
        const html=await response.text();
        if(method===HEAD){assert.equal(html,'');continue;}
        assert.match(html,/النص الكامل موجود في الاستجابة الأصلية/);
        assert.doesNotMatch(html,/<iframe\b|noindex/);
        assert.ok(html.includes('https://alelm.net'+canonical));
      }
      for (const id of ['1','11111111-1111-4111-8111-111111111111']) {
        for (const slug of ['alias','الفيفا-لعبة-المال',encodeURIComponent('الفيفا-لعبة-المال'),'%bad']) {
          if(id==='1'&&['الفيفا-لعبة-المال',encodeURIComponent('الفيفا-لعبة-المال')].includes(slug))continue;
          const response=await invoke(method,id,slug);
          assert.equal(response.status,308);
          assert.equal(response.headers.get('location'),canonical+query);
        }
      }
      for(const id of ['missing','draft','archived']) {
        const response=await invoke(method,id,'alias');
        assert.equal(response.status,404);
        assert.match(response.headers.get('x-robots-tag'),/noindex/);
        assert.match(response.headers.get('content-security-policy'),/sandbox/);
        assert.equal(response.headers.get('cache-control'),'private, no-store');
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
