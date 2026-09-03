import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("مسطرة السلاسل وشريط الأخبار خارج الهيدر حتى تلتصق المسطرة وحدها", async () => {
  const [chrome, css] = await Promise.all([
    read("app/_components/site-chrome.tsx"),
    read("app/header.css"),
  ]);
  const headerClose = chrome.indexOf("</header>");
  const rail = chrome.indexOf("<SeriesRail");
  const chips = chrome.indexOf("top-series-mobile");
  const news = chrome.indexOf("<BreakingBar");
  assert.ok(headerClose > 0 && rail > headerClose, "مسطرة السلاسل يجب أن تخرج من الهيدر");
  assert.ok(chips > headerClose, "رقائق الجوال يجب أن تخرج من الهيدر");
  assert.ok(news > headerClose, "شريط الأخبار يجب أن يخرج من الهيدر");
  assert.match(css, /\.topbar\.has-rail\s*\{[^}]*position:\s*static/);
  assert.match(css, /\.series-rail\s*\{[^}]*position:\s*sticky/);
  assert.match(css, /\.breaking,\s*\.breaking\.is-fresh/);
  const home = await read("app/page.tsx");
  assert.match(home, /day-line/);
});

test("شريط الأخبار يسقط لأحدث مادة إن لم يوجد عاجل سارٍ ويوسم مستجد", async () => {
  const [provider, chrome] = await Promise.all([
    read("lib/content/provider.ts"),
    read("app/_components/site-chrome.tsx"),
  ]);
  assert.match(provider, /"news-strip"/);
  assert.match(provider, /toStripItem/);
  assert.match(chrome, /urgent \? "عاجل" : "مستجد"/);
});

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
  const [join, welcome, feed, layout, editor, table] = await Promise.all([
    read("app/join/member-auth.css"),
    read("app/welcome/welcome.css"),
    read("app/for-you/for-you.css"),
    read("app/tahrir/layout.tsx"),
    read("components/tahrir/editor/editor-client.tsx"),
    read("components/tahrir/stories/stories-table.tsx"),
  ]);
  assert.match(join, /font-size:\s*16px/);
  assert.match(welcome, /\.interest-grid label\s*\{\s*min-height:\s*98px/);
  assert.match(feed, /grid-template-columns:\s*minmax\(0, 1fr\) 112px/);
  // اللوحة على جذر Tailwind مستقل؛ الاستجابة بأصناف نقاط التوقف لا بملف CSS للهاتف.
  assert.match(layout, /import "\.\/shadcn\.css"/);
  assert.doesNotMatch(layout, /mobile\.css|tahrir\.css/);
  assert.match(editor, /xl:grid-cols-\[minmax\(0,1fr\)_340px\]/);
  assert.match(table, /md:hidden/);
});
