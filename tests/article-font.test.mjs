import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("متن المقال يستخدم نَسخًا عربيًا ولا يغيّر خط الواجهة", async () => {
  const [root, globals, page] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/[section]/[id]/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(root, /Noto_Naskh_Arabic/);
  assert.match(root, /--f-article/);
  assert.match(root, /preload:\s*false/);
  assert.match(root, /Readex_Pro/);
  assert.match(globals, /--font-article/);
  assert.match(globals, /\.article-body \{[\s\S]*font-family:\s*var\(--font-article\)/u);
  assert.match(page, /className="article-body"/);
  assert.match(page, /storyHref\(story\)/);
});
