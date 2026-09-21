#!/usr/bin/env node
/**
 * M-0: جرد ووردبريس القديم عبر REST العام — قراءة فقط، لا يلمس النظام القديم.
 *   node scripts/wp-inventory.mjs            # ملخص + حفظ التقرير في docs/metrics/
 *
 * المخرج: docs/metrics/wp-inventory.json — مرجع البروفة والهجرة وتقرير الفروقات.
 */

import { writeFile } from "node:fs/promises";

const BASE = "https://dash.alelm.net/wp-json/wp/v2";

async function totalOf(path) {
  const response = await fetch(`${BASE}/${path}${path.includes("?") ? "&" : "?"}per_page=1`);
  if (!response.ok) return { total: null, error: response.status };
  return { total: Number(response.headers.get("X-WP-Total")) };
}

async function allTerms(path) {
  const terms = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(`${BASE}/${path}?per_page=100&page=${page}&orderby=count&order=desc`);
    if (!response.ok) break;
    const batch = await response.json();
    terms.push(...batch.map((t) => ({ id: t.id, slug: t.slug, name: t.name, count: t.count })));
    if (batch.length < 100) break;
  }
  return terms;
}

console.log("جرد ووردبريس — قراءة فقط عبر REST العام…\n");

const [posts, media, pages, categories, tags, posttypes, poststatuses] = await Promise.all([
  totalOf("posts"),
  totalOf("media"),
  totalOf("pages"),
  allTerms("categories"),
  allTerms("tags"),
  allTerms("posttype"),
  allTerms("poststatus"),
]);

// عينة تحقق: أول مقال وآخر مقال (بنية الرابط والحقول)
const sample = await (await fetch(`${BASE}/posts?per_page=2&orderby=date&order=desc`)).json();
const sampleLinks = sample.map((p) => ({ id: p.id, link: p.link, status: p.status }));

const activeTags = tags.filter((t) => t.count > 0);
const junkTags = tags.filter((t) => t.count === 0);

const report = {
  generatedAt: new Date().toISOString(),
  source: `${BASE} (قراءة عامة)`,
  totals: {
    posts: posts.total,
    media: media.total,
    pages: pages.total,
  },
  categories,
  tags: { active: activeTags, junkCount: junkTags.length },
  postTypes: posttypes,
  postStatuses: poststatuses,
  sampleLinks,
};

await writeFile(
  new URL("../docs/metrics/wp-inventory.json", import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`,
);

console.log(`المواد: ${posts.total} · الوسائط: ${media.total} · الصفحات: ${pages.total}`);
console.log(`التصنيفات: ${categories.length} · وسوم فعالة: ${activeTags.length} · وسوم مهملة: ${junkTags.length}`);
console.log(`الأنواع: ${posttypes.map((t) => `${t.slug}=${t.count}`).join(" · ")}`);
console.log(`نموذج رابط: ${sampleLinks[0]?.link ?? "—"}`);
console.log("\nحُفظ التقرير: docs/metrics/wp-inventory.json");
