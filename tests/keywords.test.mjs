import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { storyKeywords, keywordHref, decodeKeywordParam } from "../lib/content/keywords.ts";

test("keywords discard malformed values and duplicates without conflating different topics", () => {
  assert.deepEqual(storyKeywords([" السعودية ", "السعودية", "اقتصاد السعودية", "", null, 12]), ["السعودية", "اقتصاد السعودية"]);
  assert.deepEqual(storyKeywords(null), []);
  assert.deepEqual(storyKeywords("السعودية"), []);
});

test("article keywords render safe working links and omit an empty keyword section", async () => {
  const result = await build({ entryPoints: ["app/_components/article-keywords.tsx"], bundle: true, platform: "node", format: "cjs", packages: "external", write: false });
  const compiled = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
  const { ArticleKeywords } = compiled.exports;
  const html = renderToStaticMarkup(ArticleKeywords({ keywords: ["الذكاء الاصطناعي", "الذكاء الاصطناعي", "<script>alert(1)</script>"] }));
  assert.ok(html.includes(`href="${keywordHref("الذكاء الاصطناعي")}"`));
  assert.equal((html.match(/rel="tag"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<script>/);
  assert.equal(renderToStaticMarkup(ArticleKeywords({ keywords: [] })), "");
});

test("keyword links round-trip Arabic, literal percent, separators and query characters", () => {
  for (const word of ["الذكاء الاصطناعي", "أرامكو", "C++", "AI/ML", "نمو 10%", "A?b#c", "%2F"]) {
    const path = keywordHref(word);
    assert.equal(path.split("/").length, 3);
    assert.equal(decodeURIComponent(path.split("/").at(-1)), word);
    assert.equal(decodeKeywordParam(path.split("/").at(-1)), word);
    assert.equal(new URL(path, "https://alelm.test").search, "");
    assert.equal(new URL(path, "https://alelm.test").hash, "");
  }
});
