import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("الهاتف يملك تنقلًا صريحًا بدل إخفاء الأقسام", async () => {
  const [chrome, css] = await Promise.all([
    read("app/_components/site-chrome.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(chrome, /className="mobile-nav"/);
  assert.match(chrome, /التنقل الرئيسي للجوال/);
  assert.match(css, /\.mobile-nav\s*\{\s*display:\s*none/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.mobile-nav\s*\{[\s\S]*display:\s*flex/);
});

test("قوائم المواد على الهاتف بطاقات أفقية كثيفة", async () => {
  const [css, pagination, search] = await Promise.all([
    read("app/globals.css"), read("lib/content/pagination.ts"), read("app/search/page.tsx"),
  ]);
  assert.match(css, /\.grid-3 \.m-card[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 112px/);
  assert.match(css, /\.section-feed \.m-card:not\(\.section-lead\)/);
  assert.match(css, /\.series-feed \.m-card:not\(\.series-lead\)/);
  assert.match(css, /\.series-directory-card\s*\{\s*min-height:\s*0/);
  assert.match(pagination, /LIST_PAGE_SIZE = 18/);
  assert.match(search, /<Pagination basePath="\/search"/);
});

test("العضوية ولوحة التحرير لهما قواعد هاتف مستقلة", async () => {
  const [join, welcome, feed, layout, tahrir] = await Promise.all([
    read("app/join/member-auth.css"),
    read("app/welcome/welcome.css"),
    read("app/for-you/for-you.css"),
    read("app/tahrir/layout.tsx"),
    read("app/tahrir/mobile.css"),
  ]);
  assert.match(join, /font-size:\s*16px/);
  assert.match(welcome, /\.interest-grid label\s*\{\s*min-height:\s*98px/);
  assert.match(feed, /grid-template-columns:\s*minmax\(0, 1fr\) 112px/);
  assert.match(layout, /import "\.\/mobile\.css"/);
  assert.match(tahrir, /@media screen and \(max-width: 700px\)/);
  assert.match(tahrir, /\.th-ed[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
});
