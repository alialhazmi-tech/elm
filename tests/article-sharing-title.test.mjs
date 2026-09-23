import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { transform } from "esbuild";
import * as jsx from "react/jsx-runtime";
import * as sharing from "../lib/sharing.ts";
import { shortStoryHref, storyHref } from "../lib/content/types.ts";
import { publicShareUrl } from "../lib/sharing-contract.ts";
import * as canonicalStories from "../lib/content/canonical-stories.ts";

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
    "@/lib/content/types": { storyHref, shortStoryHref },
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

test("verified duplicate redirects before loading related content and preserves the record", async () => {
  const story = { id: "1658", section: "world", slug: "خطط-دولية-ربما-تجبر-الشركات-الكبرى-على-2" };
  const before = { ...story };
  let location;
  const redirected = new Error("redirected");
  const { default: ArticlePage } = await loadComponent("../app/[section]/[id]/[slug]/page.tsx", {
    "@/lib/content/provider": {
      seedContentProvider: {
        getStory: async () => story,
        listRelated: async () => assert.fail("No secondary queries before the redirect"),
      },
    },
    "@/lib/content/types": { storyHref, shortStoryHref },
    "@/lib/content/canonical-stories": canonicalStories,
    "next/navigation": { permanentRedirect: value => { location = value; throw redirected; } },
  });
  await assert.rejects(ArticlePage({ params: Promise.resolve(story) }), error => error === redirected);
  assert.equal(location, encodeURI("/world/1660/خطط-دولية-ربما-تجبر-الشركات-الكبرى-على"));
  assert.deepEqual(story, before);
});

test("legacy UUID link of a tahrir story redirects to its short public number", async () => {
  const story = { id: "4a48f291-fe4a-4d46-9283-22530bd1e9d2", publicNumber: 300042, section: "politics", slug: "رحلة-السعودية" };
  let location;
  const redirected = new Error("redirected");
  const { default: ArticlePage } = await loadComponent("../app/[section]/[id]/[slug]/page.tsx", {
    "@/lib/content/provider": {
      seedContentProvider: {
        getStory: async () => story,
        listRelated: async () => assert.fail("No secondary queries before the redirect"),
      },
    },
    "@/lib/content/types": { storyHref, shortStoryHref },
    "@/lib/content/canonical-stories": canonicalStories,
    "next/navigation": { permanentRedirect: value => { location = value; throw redirected; } },
  });
  await assert.rejects(ArticlePage({ params: Promise.resolve({ section: story.section, id: story.id, slug: encodeURIComponent(story.slug) }) }), error => error === redirected);
  assert.equal(location, encodeURI("/politics/300042/رحلة-السعودية"));
});

test("share button sends the reader title as title and text, with a URL-only clipboard fallback", async () => {
  const shared = [], copied = [];
  const navigator = {
    share: async payload => shared.push(payload),
    clipboard: { writeText: async value => copied.push(value) },
  };
  const { ArticleToolbar } = await loadComponent("../app/_components/article-experience.tsx", {
    "react/jsx-runtime": jsx,
    "@/app/_components/use-article-state": { useArticleState: () => [{ signedIn: false }] },
    react: { useState: initial => [initial, () => {}], useEffect: () => {} },
  }, { navigator, document: { title: "عنوان SEO مختلف | العلم" } });
  const props = {
    storyId: "123", title: "عنوان الخبر الظاهر للقارئ", excerpt: "موجز",
    joinHref: "/join", shareUrl: publicShareUrl("/sciences/123/news", "https://alelm.net"),
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
