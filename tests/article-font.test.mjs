import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("متن المقال يشترك مع النصوص الفرعية في خط واحد ولا يغيّر خط العناوين", async () => {
  const [root, globals, page] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/[section]/[id]/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);

  // خط واحد لكل النصوص الفرعية: المتون والنبذ والميتا.
  assert.match(root, /IBM_Plex_Sans_Arabic/);
  assert.match(root, /variable:\s*"--f-text"/);
  assert.doesNotMatch(root, /Readex_Pro|Noto_Naskh_Arabic/);

  // خط العناوين يبقى مستقلًا عن خط النصوص.
  assert.match(root, /Alexandria/);
  assert.match(root, /variable:\s*"--f-display"/);
  assert.match(globals, /--font-display:\s*var\(--f-display/);

  // متن المقال يتبع خط النصوص عبر الرمز نفسه.
  assert.match(globals, /--font-article:\s*var\(--font-text\)/);
  assert.match(globals, /\.article-body \{[\s\S]*font-family:\s*var\(--font-article\)/u);
  assert.match(page, /className="article-body"/);
  assert.match(page, /storyHref\(story\)/);
});
