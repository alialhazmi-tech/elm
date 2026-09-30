import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { build } from "esbuild";

test("Arabic report links render in encoded and decoded form without a self redirect", async () => {
  const directory = await mkdtemp("tmp/jak-route-");
  try {
    await build({
      entryPoints: ["app/jak/[id]/[slug]/page.tsx"], outfile: `${directory}/page.mjs`,
      bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic",
      plugins: [{ name: "report-fixture", setup(builder) {
        builder.onResolve({ filter: /^(next\/|@\/)/ }, args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ loader: "js", contents:
          path === "next/navigation" ? "export function notFound(){throw new Error('404')} export function permanentRedirect(path){throw new Error('308:'+path)}" :
          path.endsWith("jak-reports") ? "export async function getJakReport(){return {id:'test',slug:'الفيفا-لعبة-المال',title:'الفيفا',status:'published',excerpt:''}}" :
          path.endsWith("jak-code-frame") ? "export const JakCodeFrame=()=>null" :
          path.endsWith("site-chrome") ? "export const SiteHeader=()=>null;export const SiteFooter=()=>null" : "export default ()=>null",
        }));
      } }],
    });
    const { default: page } = await import(`../${directory}/page.mjs`);
    for (const slug of ["الفيفا-لعبة-المال", encodeURIComponent("الفيفا-لعبة-المال")]) {
      assert.ok(await page({ params: Promise.resolve({ id: "test", slug }) }));
    }
    await assert.rejects(page({ params: Promise.resolve({ id: "test", slug: "alias" }) }), /308:/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
