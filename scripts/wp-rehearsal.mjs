#!/usr/bin/env node
/**
 * M-1: بروفة الهجرة — سحب مواد حقيقية من ووردبريس (قراءة فقط) إلى قاعدتنا.
 *
 *   node --env-file=.env.local scripts/wp-rehearsal.mjs           # 500 مادة
 *   node --env-file=.env.local scripts/wp-rehearsal.mjs --count=200
 *   node --env-file=.env.local scripts/wp-rehearsal.mjs --count=5 --with-media
 *   node --env-file=.env.local scripts/wp-rehearsal.mjs --rollback  # حذف ما استوردته البروفة
 *
 * الضمانات: لا كتابة على ووردبريس إطلاقًا؛ المعرف الأصلي يُحفظ كما هو
 * (حماية الروابط)؛ upsert آمن للتكرار؛ والتراجع بقائمة المعرفات المحفوظة.
 * المخرج: docs/metrics/wp-rehearsal.json — تقرير البروفة الكامل.
 * مع --with-media يُكتب docs/metrics/wp-media-sample.json حتى لا يُمس تقرير الـ500.
 */

import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";

const BASE = "https://dash.alelm.net/wp-json/wp/v2";
const FULL_REPORT = new URL("../docs/metrics/wp-rehearsal.json", import.meta.url);
const MEDIA_REPORT = new URL("../docs/metrics/wp-media-sample.json", import.meta.url);

const args = process.argv.slice(2);
const COUNT = Number(args.find((a) => a.startsWith("--count="))?.split("=")[1] ?? 500);
const ROLLBACK = args.includes("--rollback");
const WITH_MEDIA = args.includes("--with-media");
const REPORT_PATH = WITH_MEDIA ? MEDIA_REPORT : FULL_REPORT;

const sql = neon(process.env.DATABASE_URL);

function storageConfig() {
  const endpoint = (process.env.AWS_ENDPOINT_URL || process.env.BUCKET_ENDPOINT || "").trim();
  const bucket = (process.env.AWS_S3_BUCKET_NAME || process.env.BUCKET_NAME || "").trim();
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || process.env.BUCKET_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || process.env.BUCKET_SECRET_ACCESS_KEY || "").trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("متغيرات المخزن غير مكتملة. يلزم AWS_S3_BUCKET_NAME وAWS_ENDPOINT_URL ومفاتيح AWS.");
  }
  const region = /storageapi\.dev$/i.test(new URL(endpoint).hostname)
    ? "auto"
    : (process.env.AWS_DEFAULT_REGION || process.env.BUCKET_REGION || "auto").trim();
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

function storageClient() {
  const config = storageConfig();
  return {
    s3: new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
    bucket: config.bucket,
  };
}

function sniffImage(bytes) {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { mime: "image/png", ext: "png" };
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.length > 16 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

async function archiveFeaturedImage(sourceUrl, storyId) {
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": "alelm-migration/1.0" },
  });
  if (!response.ok) throw new Error(`تنزيل الصورة ${response.status}`);
  const body = new Uint8Array(await response.arrayBuffer());
  const kind = sniffImage(body);
  if (!kind) throw new Error("صيغة الصورة غير مدعومة (يلزم PNG أو JPEG أو WebP)");

  const id = randomUUID();
  const filename = `${id}.${kind.ext}`;
  const key = `uploads/${filename}`;
  const url = `/uploads/${filename}`;
  const { s3, bucket } = storageClient();
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: kind.mime,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  const stored = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (stored.ContentLength !== body.byteLength) {
    throw new Error("تعذر التحقق من اكتمال حفظ الصورة في البوكت.");
  }

  await sql`
    insert into media (id, url, filename, mime, bytes, width, height, rights_cleared, flags, uploaded_by, created_at, ai_generated)
    values (${id}, ${url}, ${`wp-${storyId}.${kind.ext}`}, ${kind.mime}, ${body.byteLength},
            ${null}, ${null}, ${1}, ${"legacy"}, ${"wp-rehearsal"}, ${new Date().toISOString()}, ${0})
    on conflict (id) do nothing`;

  return { url, bytes: body.byteLength, mime: kind.mime };
}

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

/** موجز العرض لا يتجاوز ~180 حرفًا — القطع على حدود الكلمات، والحسم بعلامة «…». */
const EXCERPT_MAX = 180;
const clampExcerpt = (input) => {
  const wpTruncated = /(\[…\]|…)\s*$/u.test(input);
  const text = input.replace(/\s*(\[…\]|…)\s*$/u, "").trim();
  if (text.length <= EXCERPT_MAX) return wpTruncated ? `${text}…` : text;
  const cut = text.slice(0, EXCERPT_MAX + 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 120 ? space : EXCERPT_MAX).replace(/[،؛:.\s]+$/u, "")}…`;
};

const cleanExcerpt = (t) => clampExcerpt(htmlToParagraphs(t).replace(/\n+/g, " ").trim());

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

console.log(
  `بروفة الهجرة — سحب ${COUNT} مادة${WITH_MEDIA ? " مع صورها إلى البوكت" : ""} (قراءة فقط من ووردبريس)…\n`,
);

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
  const usable = WITH_MEDIA ? batch.filter((post) => post.featured_media) : batch;
  posts.push(...usable);
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
  withSeries: 0, withImage: 0, withAuthor: 0, imagesArchived: 0,
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
    let image = mediaById.get(post.featured_media) ?? null;
    const authorName = authorsById.get(post.author) ?? "";
    if (WITH_MEDIA && image) {
      try {
        const archived = await archiveFeaturedImage(image, id);
        image = archived.url;
        stats.imagesArchived += 1;
        process.stdout.write(`  بوكت: ${stats.imagesArchived} صورة (${archived.mime}, ${archived.bytes} بايت)\n`);
      } catch (error) {
        stats.issues.push({ id: post.id, error: `وسائط: ${String(error).slice(0, 160)}` });
      }
    }

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
  withMedia: WITH_MEDIA,
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
صور نُقلت إلى البوكت: ${stats.imagesArchived}
الأقسام: ${JSON.stringify(stats.sections)}
الأشكال: ${JSON.stringify(stats.formats)}
التقرير: ${WITH_MEDIA ? "docs/metrics/wp-media-sample.json" : "docs/metrics/wp-rehearsal.json"}`);
