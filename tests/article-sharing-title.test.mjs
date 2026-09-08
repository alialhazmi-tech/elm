import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { transform } from "esbuild";
import * as jsx from "react/jsx-runtime";
import * as sharing from "../lib/sharing.ts";
import { storyHref } from "../lib/content/types.ts";
import { refreshedShareUrl } from "../lib/sharing-contract.ts";

async function loadComponent(path, imports, globals = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { code } = await transform(source, { loader: "tsx", format: "cjs", jsx: "automatic" });
  const compiled = { exports: {} };
  vm.runInNewContext(code, {
    module: compiled, exports: compiled.exports,
    require: name => imports[name] ?? {},
    ...globals,
  });
  return compiled.exports;
}

test("article metadata keeps SEO title separate from the reader title in link previews", async () => {
  const story = {
    id: "123", section: "sciences", slug: "خبر-عربي",
    title: "عنوان الخبر الظاهر للقارئ", seoTitle: "عنوان مختلف لمحركات البحث",
    excerpt: "موجز الخبر", seoDescription: "وصف البحث", image: "/uploads/photo.jpg",
  };
  const { generateMetadata } = await loadComponent("../app/[section]/[id]/[slug]/page.tsx", {
    "@/lib/content/provider": { seedContentProvider: { getStory: async () => story } },
    "@/lib/content/types": { storyHref },
    "@/lib/sharing": sharing,
  });
  for (const seoTitle of ["عنوان مختلف لمحركات البحث", undefined]) {
    story.seoTitle = seoTitle;
    const metadata = await generateMetadata({ params: Promise.resolve({ id: story.id }) });
    assert.equal(metadata.title, seoTitle || story.title);
    assert.equal(metadata.openGraph.title, story.title);
    assert.equal(metadata.twitter.title, story.title);
    assert.equal(metadata.openGraph.images[0].alt, story.title);
    assert.equal(metadata.description, story.seoDescription);
    assert.equal(metadata.alternates.canonical, storyHref(story));
  }
});

test("share button sends the reader title as title and text, with a URL-only clipboard fallback", async () => {
  const shared = [], copied = [];
  const navigator = {
    share: async payload => shared.push(payload),
    clipboard: { writeText: async value => copied.push(value) },
  };
  const { ArticleToolbar } = await loadComponent("../app/_components/article-experience.tsx", {
    "react/jsx-runtime": jsx,
    react: { useState: initial => [initial, () => {}], useEffect: () => {} },
  }, { navigator, document: { title: "عنوان SEO مختلف | العلم" } });
  const props = {
    storyId: "123", title: "عنوان الخبر الظاهر للقارئ", excerpt: "موجز",
    joinHref: "/join", shareUrl: refreshedShareUrl("/sciences/123/news", "https://alelm.net"),
  };
  const nodes = node => !node || typeof node !== "object" ? []
    : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  const clickShare = () => nodes(ArticleToolbar(props))
    .find(node => node.type === "button" && node.props.children === "مشاركة").props.onClick();
  clickShare();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(shared[0].title, props.title);
  assert.equal(shared[0].text, props.title);
  assert.equal(shared[0].url, props.shareUrl);
  assert.equal(copied.length, 0);
  navigator.share = undefined;
  clickShare();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(copied, [props.shareUrl]);
});
