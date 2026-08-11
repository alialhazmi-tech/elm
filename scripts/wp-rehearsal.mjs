#!/usr/bin/env node
/**
 * M-1: بروفة الهجرة — سحب مواد حقيقية من ووردبريس (قراءة فقط) إلى قاعدتنا.
 *
 *   node --env-file=.env.local scripts/wp-rehearsal.mjs           # 500 مادة
 *   node --env-file=.env.local scripts/wp-rehearsal.mjs --count=200
 *   node --env-file=.env.local scripts/wp-rehearsal.mjs --rollback  # حذف ما استوردته البروفة
 *
 * الضمانات: لا كتابة على ووردبريس إطلاقًا؛ المعرف الأصلي يُحفظ كما هو
 * (حماية الروابط)؛ upsert آمن للتكرار؛ والتراجع بقائمة المعرفات المحفوظة.
 * المخرج: docs/metrics/wp-rehearsal.json — تقرير البروفة الكامل.
 */

import { readFile, writeFile } from "node:fs/promises";

import { neon } from "@neondatabase/serverless";

const BASE = "https://dash.alelm.net/wp-json/wp/v2";
const REPORT_PATH = new URL("../docs/metrics/wp-rehearsal.json", import.meta.url);

const args = process.argv.slice(2);
const COUNT = Number(args.find((a) => a.startsWith("--count="))?.split("=")[1] ?? 500);
const ROLLBACK = args.includes("--rollback");

const sql = neon(process.env.DATABASE_URL);

/* ============ التراجع ============ */
if (ROLLBACK) {
  const report = JSON.parse(await readFile(REPORT_PATH, "utf8"));
  const ids = report.importedIds ?? [];
  if (ids.length === 0) {
    console.log("لا معرفات محفوظة للتراجع.");
    process.exit(0);
  }
  await sql`delete from stories where id = any(${ids})`;
  console.log(`تراجعت البروفة — حُذفت ${ids.length} مادة من قاعدتنا (ووردبريس لم يُمس أصلًا).`);
  process.exit(0);
}

/* ============ أدوات التحويل ============ */

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", shy: "", zwnj: "‌",
};

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

/** HTML ووردبريس → نص نظيف بفقرات يفصلها سطران. */
function htmlToParagraphs(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<figure[\s\S]*?<\/figure>/gi, "")
      .replace(/\[[a-z_/][^\]]*\]/gi, "")            // شورت كودات ووردبريس/Oxygen
      .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

const cleanTitle = (t) => decodeEntities(t).replace(/\s+/g, " ").trim();

const cleanExcerpt = (t) =>
  htmlToParagraphs(t).replace(/\s*\[…\]\s*$/, "…").replace(/\n+/g, " ").trim();

/** وسم السلسلة (بالاسم العربي) → سلاج سلاسلنا. */
const SERIES_BY_TAG = {
  "#بالأرقام": "bel-arqam", "#أبسط": "absat", "#لماذا": "limatha",
  "#افهمها_صح": "efhamha-sah", "#بالتاريخ": "bel-tarikh", "#شخصيات": "shakhsiat",
  "#أغرب": "aghrab", "#ماذا_لو": "matha-law", "#ماذا_بعد": "matha-baad",
  "#قالوا": "qalu", "#تقارير": "taqarir", "#موثق": "muwaththaq",
  "#العلم_في_المونديال": "elm-mondial",
};

const FORMAT_BY_POSTTYPE = {
  news: "news", infographics: "infographics", videos: "videos",
  reports: "reports", podcasts: "podcasts", jakalelm: "news",
};

const VALID_SECTIONS = new Set([
  "current-events", "politics", "economy", "varieties", "world", "health",
  "technology", "sciences", "sport", "ksa", "infographics", "business", "art", "culture",
]);

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} على ${url}`);
  return response.json();
}

async function fetchAllTerms(path) {
  const terms = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await fetchJson(`${BASE}/${path}?per_page=100&page=${page}&_fields=id,slug,name`);
    terms.push(...batch);
    if (batch.length < 100) break;
  }
  return terms;
}

/* ============ السحب ============ */

console.log(`بروفة الهجرة — سحب ${COUNT} مادة (قراءة فقط من ووردبريس)…\n`);

const [tags, posttypes] = await Promise.all([
  fetchAllTerms("tags"),
  fetchAllTerms("posttype"),
]);
const seriesByTagId = new Map(
  tags.filter((t) => SERIES_BY_TAG[t.name]).map((t) => [t.id, SERIES_BY_TAG[t.name]]),
);
const formatByTypeId = new Map(
  posttypes.map((t) => [t.id, FORMAT_BY_POSTTYPE[t.slug] ?? "news"]),
);

let authorsById = new Map();
try {
  const users = await fetchJson(`${BASE}/users?per_page=100&_fields=id,name`);
  authorsById = new Map(users.map((u) => [u.id, u.name]));
} catch {
  console.log("(أسماء المؤلفين غير متاحة عبر REST — تُترك فارغة)");
}

const FIELDS = "id,slug,link,title,content,excerpt,date_gmt,modified_gmt,categories,tags,posttype,featured_media,author";
const posts = [];
for (let page = 1; posts.length < COUNT; page += 1) {
  const batch = await fetchJson(`${BASE}/posts?per_page=100&page=${page}&_fields=${FIELDS}`);
  posts.push(...batch);
  process.stdout.write(`  سحب المواد: ${Math.min(posts.length, COUNT)}/${COUNT}\r`);
  if (batch.length < 100) break;
}
posts.length = Math.min(posts.length, COUNT);
console.log(`\n  سُحبت ${posts.length} مادة.`);

// الصور البارزة دفعات
const mediaIds = [...new Set(posts.map((p) => p.featured_media).filter(Boolean))];
const mediaById = new Map();
for (let i = 0; i < mediaIds.length; i += 100) {
  const chunk = mediaIds.slice(i, i + 100);
  const batch = await fetchJson(
    `${BASE}/media?include=${chunk.join(",")}&per_page=100&_fields=id,source_url`,
  ).catch(() => []);
  for (const m of batch) mediaById.set(m.id, m.source_url);
  process.stdout.write(`  سحب الصور: ${Math.min(i + 100, mediaIds.length)}/${mediaIds.length}\r`);
}
console.log(`\n  صور بارزة: ${mediaById.size}/${mediaIds.length}.`);

/* ============ التحويل والإدخال ============ */

const stats = {
  imported: 0, urlIdentical: 0, urlNeedsRedirect: 0,
  withSeries: 0, withImage: 0, withAuthor: 0,
  sections: {}, formats: {}, series: {}, issues: [],
};
const importedIds = [];
const urlMismatches = [];

for (const post of posts) {
  try {
    const link = new URL(post.link);
    const segments = link.pathname.split("/").filter(Boolean);
    let section = segments[0] ?? "varieties";
    let needsRedirect = false;

    if (!VALID_SECTIONS.has(section)) {
      // «غير مصنف» بنسختيه → منوعات، مع تسجيلها كحالة تحويل
      section = "varieties";
      needsRedirect = true;
    }

    const id = String(post.id);
    const slug = (() => {
      try { return decodeURIComponent(post.slug); } catch { return post.slug; }
    })();

    const seriesSlug = (post.tags ?? []).map((t) => seriesByTagId.get(t)).find(Boolean) ?? null;
    const format = (post.posttype ?? []).map((t) => formatByTypeId.get(t)).find(Boolean) ?? "news";
    const body = htmlToParagraphs(post.content?.rendered ?? "");
    const words = body.split(/\s+/).filter(Boolean).length;
    const image = mediaById.get(post.featured_media) ?? null;
    const authorName = authorsById.get(post.author) ?? "";

    // مطابقة الرابط: مسارنا مقابل مسار ووردبريس بايتًا ببايت (بعد الترميز)
    const ourPath = `/${section}/${id}/${encodeURIComponent(slug)}`;
    const wpPath = link.pathname.replace(/\/$/, "");
    // مقارنة غير حساسة لحالة الترميز — %D9 و%d9 رابط واحد بمعيار RFC 3986
    if (!needsRedirect && ourPath.toLowerCase() === wpPath.toLowerCase()) stats.urlIdentical += 1;
    else {
      stats.urlNeedsRedirect += 1;
      if (urlMismatches.length < 20) urlMismatches.push({ id, ours: ourPath, wp: wpPath });
    }

    await sql`
      insert into stories (id, slug, section, title, excerpt, eyebrow, reading_minutes,
                           series_slug, image, published_at, status, body, author_name,
                           updated_at, format)
      values (${id}, ${slug}, ${section}, ${cleanTitle(post.title?.rendered ?? "")},
              ${cleanExcerpt(post.excerpt?.rendered ?? "")}, ${""},
              ${Math.min(15, Math.max(1, Math.round(words / 200)))},
              ${seriesSlug}, ${image}, ${post.date_gmt ? post.date_gmt + "Z" : null},
              ${"published"}, ${body}, ${authorName},
              ${post.modified_gmt ? post.modified_gmt + "Z" : null}, ${format})
      on conflict (id) do update set
        slug = excluded.slug, section = excluded.section, title = excluded.title,
        excerpt = excluded.excerpt, series_slug = excluded.series_slug,
        image = excluded.image, published_at = excluded.published_at,
        body = excluded.body, author_name = excluded.author_name,
        updated_at = excluded.updated_at, format = excluded.format`;

    importedIds.push(id);
    stats.imported += 1;
    if (seriesSlug) { stats.withSeries += 1; stats.series[seriesSlug] = (stats.series[seriesSlug] ?? 0) + 1; }
    if (image) stats.withImage += 1;
    if (authorName) stats.withAuthor += 1;
    stats.sections[section] = (stats.sections[section] ?? 0) + 1;
    stats.formats[format] = (stats.formats[format] ?? 0) + 1;
    process.stdout.write(`  إدخال: ${stats.imported}/${posts.length}\r`);
  } catch (error) {
    stats.issues.push({ id: post.id, error: String(error).slice(0, 120) });
  }
}

console.log(`\n  أُدخلت ${stats.imported} مادة (${stats.issues.length} إخفاق).`);

/* ============ التقرير ============ */

const report = {
  generatedAt: new Date().toISOString(),
  requested: COUNT,
  ...stats,
  urlMismatchSamples: urlMismatches,
  importedIds,
};
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log(`
——— خلاصة البروفة ———
المستوردة: ${stats.imported}
روابط مطابقة بايتًا ببايت: ${stats.urlIdentical} (${Math.round((stats.urlIdentical / stats.imported) * 100)}%)
تحتاج تحويل 301: ${stats.urlNeedsRedirect}
بسلسلة: ${stats.withSeries} · بصورة: ${stats.withImage} · بمؤلف: ${stats.withAuthor}
الأقسام: ${JSON.stringify(stats.sections)}
الأشكال: ${JSON.stringify(stats.formats)}
التقرير: docs/metrics/wp-rehearsal.json`);
