import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("podcast SSR exposes matching series, episode text and stable anchor links before JavaScript", async () => {
  await mkdir("tmp", { recursive: true });
  const directory = await mkdtemp("tmp/podcast-schema-");
  try {
    const output = await build({ entryPoints: ["app/_components/podcast-show-view.tsx"], bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic", write: false,
      plugins: [{ name: "render-context", setup(b) {
        b.onResolve({ filter: /^(next\/(image|link)|\.\/podcast-dock)$/ }, args => ({ path: args.path, namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "./podcast-dock"
          ? "export function usePodcastDock(){return {track:null,playing:false,play(){}}}"
          : args.path === "next/image"
            ? "import {createElement} from 'react'; export default function Image({src,alt}){return createElement('img',{src,alt})}"
            : "import {createElement} from 'react'; export default function Link({href,children}){return createElement('a',{href},children)}", loader: "js", resolveDir: process.cwd() }));
      } }],
    });
    const filename = resolve(directory, "subject.mjs");
    await writeFile(filename, output.outputFiles[0].text);
    const { PodcastShowView } = await import(pathToFileURL(filename).href);
    const props = {
      show: { id: "sample", name: "برنامج العلم", description: "", storyId: null, accent: "#222", feedUrl: null, youtube: "https://www.youtube.com/c/alelmmedia" },
      cover: null, description: "وصف البرنامج المنشور", canonicalUrl: "https://alelm.net/podcasts/sample",
      episodes: [{ title: "موضوع الحلقة", guest: null, audioUrl: "/podcast-audio/example.mp3", mime: "audio/mpeg", description: 'معلومة </script><script id="injected">bad</script>', publishedAt: "2026-10-12T10:00:00Z", duration: "12:34", episode: "2", season: null }],
    };
    const html = renderToStaticMarkup(createElement(PodcastShowView, props));
    const script = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(script);
    const graph = JSON.parse(script[1])["@graph"];
    assert.equal(graph[0].name, "برنامج العلم");
    assert.ok(html.includes("<h1>برنامج العلم</h1>"));
    assert.ok(html.includes('class="pp-ep-title">موضوع الحلقة</h3>'));
    assert.ok(html.includes("وصف البرنامج المنشور"));
    const episode = graph[1];
    const anchor = new URL(episode.url).hash.slice(1);
    assert.ok(html.includes(`id="${anchor}"`));
    assert.equal(episode.associatedMedia.contentUrl, "https://alelm.net/podcast-audio/example.mp3");
    assert.equal(episode.associatedMedia.duration, "PT754S");
    assert.doesNotMatch(html, /<script id="injected">/);
    assert.equal((html.match(/type="application\/ld\+json"/g) || []).length, 1);
    assert.ok(!graph.some(item => item["@type"] === "NewsArticle"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
