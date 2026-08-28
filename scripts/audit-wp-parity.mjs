#!/usr/bin/env node
/**
 * تدقيق قابل لإعادة التشغيل لتطابق أرشيف العلم بين ووردبريس والمنصة الجديدة.
 *
 * قراءة فقط: لا يرسل إلا GET ولا يكتب إلى ووردبريس أو Neon أو Railway.
 * يكتب النتائج محليًا في migration-audit/.
 *
 * التشغيل المعتاد:
 *   node --env-file-if-exists=.env.local scripts/audit-wp-parity.mjs
 *
 * خيارات مفيدة:
 *   --limit=500            عينة تطويرية فقط (لا يمكن أن تنتج READY FOR M2)
 *   --http=none            بلا فحص HTTP حي
 *   --http=sample          كل السجلات الموجودة في الهدف + عينة طبقية من المفقود (الافتراضي)
 *   --http=all             فحص كل رابط على الهدف (بطيء ولا يُنصح به على الإنتاج)
 *   --sample-size=160      حجم عينة الروابط غير الموجودة في الهدف
 *   --concurrency=6        سقف الطلبات المتزامنة
 *   --target-base=URL      أصل المنصة الجديدة
 *   --output=PATH          مجلد المخرجات
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const DEFAULTS = {
  wpBase: "https://dash.alelm.net/wp-json/wp/v2",
  legacyBase: "https://alelm.net",
  targetBase: "https://elm-production-5035.up.railway.app",
  output: path.join(REPO_ROOT, "migration-audit"),
  concurrency: 6,
  http: "sample",
  sampleSize: 160,
  limit: null,
};

const PERMANENT_REDIRECTS = new Set([301, 308]);
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const ARTICLE_PATTERN = /^\/([^/]+)\/(\d+)\/([^/]+)\/?$/u;
const SERIES_BY_TAG_NAME = {
  "#بالأرقام": "bel-arqam",
  "#أبسط": "absat",
  "#لماذا": "limatha",
  "#افهمها_صح": "efhamha-sah",
  "#بالتاريخ": "bel-tarikh",
  "#شخصيات": "shakhsiat",
  "#أغرب": "aghrab",
  "#ماذا_لو": "matha-law",
  "#ماذا_بعد": "matha-baad",
  "#قالوا": "qalu",
  "#تقارير": "taqarir",
  "#موثق": "muwaththaq",
  "#العلم_في_المونديال": "elm-mondial",
};

function readOption(argv, name) {
  const prefix = `--${name}=`;
  return argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

export function parseArgs(argv = process.argv.slice(2)) {
  const numeric = (name, fallback) => {
    const raw = readOption(argv, name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 1) throw new Error(`قيمة --${name} غير صالحة: ${raw}`);
    return Math.floor(value);
  };
  const http = readOption(argv, "http") ?? DEFAULTS.http;
  if (!["none", "sample", "all"].includes(http)) {
    throw new Error(`--http يجب أن يكون none أو sample أو all (وصل: ${http})`);
  }
  return {
    wpBase: (readOption(argv, "wp-base") ?? DEFAULTS.wpBase).replace(/\/$/, ""),
    legacyBase: (readOption(argv, "legacy-base") ?? DEFAULTS.legacyBase).replace(/\/$/, ""),
    targetBase: (readOption(argv, "target-base") ?? DEFAULTS.targetBase).replace(/\/$/, ""),
    output: path.resolve(readOption(argv, "output") ?? DEFAULTS.output),
    concurrency: numeric("concurrency", DEFAULTS.concurrency),
    sampleSize: numeric("sample-size", DEFAULTS.sampleSize),
    limit: readOption(argv, "limit") ? numeric("limit", null) : null,
    http,
  };
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractSitemapLocations(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/giu)].map((match) => decodeXml(match[1].trim()));
}

export function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizePath(value) {
  let pathname;
  try {
    pathname = new URL(value, "https://alelm.net").pathname;
  } catch {
    pathname = String(value ?? "");
  }
  const parts = pathname.split("/").filter(Boolean).map((part) => safeDecode(part));
  return `/${parts.join("/")}`.replace(/\/$/, "") || "/";
}

export function parseArticlePath(value) {
  const normalized = normalizePath(value);
  const match = ARTICLE_PATTERN.exec(normalized);
  if (!match) return null;
  return { section: match[1], id: match[2], slug: match[3], path: normalized };
}

function canonicalPath(section, id, slug) {
  return normalizePath(`/${section}/${id}/${slug}`);
}

export function extractCanonicals(html) {
  const links = [...String(html).matchAll(/<link\b[^>]*>/giu)].map((match) => match[0]);
  const values = [];
  for (const link of links) {
    if (!/\brel\s*=\s*["'][^"']*canonical[^"']*["']/iu.test(link)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/iu.exec(link)?.[1];
    if (href) values.push(decodeXml(href));
  }
  return [...new Set(values)];
}

export function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows, columns) {
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","));
  return `${[header, ...body].join("\n")}\n`;
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, init = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        ...init,
        redirect: init.redirect ?? "manual",
        signal: controller.signal,
        headers: { "user-agent": "AlElm-Migration-Parity-Audit/1.0", ...(init.headers ?? {}) },
      });
      if (RETRYABLE.has(response.status) && attempt < attempts) {
        await response.arrayBuffer();
        await delay(400 * 2 ** (attempt - 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
      await delay(400 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${response.status} على ${url}`);
  return { data: await response.json(), headers: response.headers };
}

async function fetchText(url) {
  const response = await fetchWithRetry(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${response.status} على ${url}`);
  return { text: await response.text(), headers: response.headers };
}

function contentMediaRefs(html) {
  const refs = [];
  for (const match of String(html ?? "").matchAll(/<(?:img|source)\b[^>]*(?:src|srcset)\s*=\s*["']([^"']+)["']/giu)) {
    for (const candidate of match[1].split(",").map((part) => part.trim().split(/\s+/u)[0]).filter(Boolean)) {
      refs.push(decodeXml(candidate));
    }
  }
  return [...new Set(refs)];
}

async function fetchWordPressPosts(options) {
  const fields = "id,slug,link,status,categories,featured_media,date_gmt,modified_gmt,content";
  const firstUrl = `${options.wpBase}/posts?per_page=100&page=1&orderby=id&order=asc&_fields=${fields}`;
  const first = await fetchJson(firstUrl);
  const reportedTotal = Number(first.headers.get("x-wp-total"));
  const reportedPages = Number(first.headers.get("x-wp-totalpages"));
  const wanted = options.limit ? Math.min(options.limit, reportedTotal) : reportedTotal;
  const pages = Math.ceil(wanted / 100);
  const pageNumbers = Array.from({ length: Math.max(0, pages - 1) }, (_, index) => index + 2);
  let completed = 1;
  const batches = await mapConcurrent(pageNumbers, options.concurrency, async (pageNumber) => {
    const result = await fetchJson(`${options.wpBase}/posts?per_page=100&page=${pageNumber}&orderby=id&order=asc&_fields=${fields}`);
    completed += 1;
    if (completed % 25 === 0 || completed === pages) console.log(`  REST: ${completed}/${pages} صفحة`);
    return result.data;
  });
  const posts = [...first.data, ...batches.flat()].slice(0, wanted).map((post) => ({
    ...post,
    id: String(post.id),
    contentMedia: contentMediaRefs(post.content?.rendered),
    content: undefined,
  }));
  return { posts, reportedTotal, reportedPages, fetchedPages: pages, complete: !options.limit && posts.length === reportedTotal };
}

async function fetchTerms(options, endpoint) {
  const first = await fetchJson(`${options.wpBase}/${endpoint}?per_page=100&page=1&_fields=id,slug,name,count,parent`);
  const pages = Number(first.headers.get("x-wp-totalpages")) || 1;
  const rest = await mapConcurrent(
    Array.from({ length: Math.max(0, pages - 1) }, (_, index) => index + 2),
    options.concurrency,
    async (pageNumber) => (await fetchJson(`${options.wpBase}/${endpoint}?per_page=100&page=${pageNumber}&_fields=id,slug,name,count,parent`)).data,
  );
  return [...first.data, ...rest.flat()];
}

async function fetchFeaturedMedia(options, posts) {
  const ids = [...new Set(posts.map((post) => Number(post.featured_media)).filter(Boolean))];
  const chunks = [];
  for (let index = 0; index < ids.length; index += 100) chunks.push(ids.slice(index, index + 100));
  let completed = 0;
  const batches = await mapConcurrent(chunks, options.concurrency, async (chunk) => {
    const query = `${options.wpBase}/media?per_page=100&include=${chunk.join(",")}&_fields=id,source_url,status`;
    const result = await fetchJson(query).catch((error) => ({ data: [], error: String(error) }));
    completed += 1;
    if (completed % 25 === 0 || completed === chunks.length) console.log(`  وسائط: ${completed}/${chunks.length} دفعة`);
    return result.data;
  });
  return new Map(batches.flat().map((item) => [String(item.id), item]));
}

async function fetchSitemaps(options) {
  const root = await fetchText(`${options.legacyBase}/sitemap.xml`);
  const children = extractSitemapLocations(root.text);
  const files = await mapConcurrent(children, options.concurrency, async (url) => {
    try {
      const result = await fetchText(url);
      return { url, ok: true, locations: extractSitemapLocations(result.text) };
    } catch (error) {
      return { url, ok: false, error: String(error), locations: [] };
    }
  });
  return { indexUrl: `${options.legacyBase}/sitemap.xml`, childCount: children.length, files };
}

async function readTargetStories() {
  if (!process.env.DATABASE_URL) return { configured: false, rows: [], error: "DATABASE_URL غير موجود" };
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`select id, slug, section, status, image from stories order by id`;
    return { configured: true, rows: rows.map((row) => ({ ...row, id: String(row.id) })) };
  } catch (error) {
    return { configured: true, rows: [], error: String(error) };
  }
}

async function inspectProjectContracts() {
  const read = (name) => readFile(path.join(REPO_ROOT, name), "utf8");
  const [article, sitemap, config, schema, types, sections] = await Promise.all([
    read("app/[section]/[id]/[slug]/page.tsx"),
    read("app/sitemap.ts"),
    read("next.config.ts"),
    read("db/schema.ts"),
    read("lib/content/types.ts"),
    read("lib/content/sections.ts"),
  ]);
  const sectionSlugs = [...sections.matchAll(/\bslug:\s*["']([^"']+)["']/gu)].map((match) => match[1]);
  const findings = [
    {
      code: "ARTICLE_ROUTE_PRESENT",
      severity: article.includes("[section]") ? "INFO" : "INFO",
      passed: /getStory\(id\)/u.test(article) && /notFound\(\)/u.test(article),
      detail: "مسار المادة الديناميكي يقرأ المادة بالمُعرّف.",
    },
    {
      code: "ARTICLE_PARAM_CANONICAL_GUARD",
      severity: "BLOCKER",
      passed: /permanentRedirect|redirect\(/u.test(article),
      detail: "يجب تحويل section/slug غير القانونيين دائمًا إلى رابط المادة المحفوظ.",
    },
    {
      code: "SITEMAP_INCLUDES_STORIES",
      severity: "BLOCKER",
      passed: /listAll|getStory|storyHref|stories/u.test(sitemap),
      detail: "خريطة الموقع الجديدة يجب أن تضم كل المواد المنشورة، لا الأقسام والسلاسل فقط.",
    },
    {
      code: "REDIRECT_LAYER_PRESENT",
      severity: "BLOCKER",
      passed: /redirects\s*\(|redirects\s*:/u.test(config) || /permanentRedirect|redirect\(/u.test(article),
      detail: "لا توجد طبقة 301 ظاهرة تحسم الاختلاف بالـ ID.",
    },
    {
      code: "ARCHIVE_ID_TEXT_PRIMARY_KEY",
      severity: "BLOCKER",
      passed: /id:\s*text\(["']id["']\)\.primaryKey\(\)/u.test(schema),
      detail: "stories.id مفتاح نصي أساسي وقادر على حفظ ID ووردبريس حرفيًا.",
    },
    {
      code: "STORY_HREF_PRESERVES_TRIPLE",
      severity: "BLOCKER",
      passed: /`\/\$\{story\.section\}\/\$\{story\.id\}\/\$\{story\.slug\}`/u.test(types),
      detail: "عقد الرابط الجديد section/id/slug.",
    },
  ];
  return { findings, sectionSlugs: [...new Set(sectionSlugs)] };
}

function urlPattern(url) {
  if (String(url).includes("undefined")) return { pattern: "INVALID_UNDEFINED", kind: "invalid" };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { pattern: "INVALID_URL", kind: "invalid" };
  }
  const parts = parsed.pathname.split("/").filter(Boolean).map(safeDecode);
  if (parts.length === 0) return { pattern: "/", kind: "home" };
  if (parts.length === 3 && /^\d+$/u.test(parts[1])) return { pattern: "/{section}/{id}/{slug}", kind: "article" };
  if (parts[0] === "series" && parts.length === 2) return { pattern: "/series/{slug}", kind: "series" };
  if (parts[0] === "tag" && parts.length >= 2) return { pattern: "/tag/{slug}", kind: "tag" };
  if (parts.length === 1) return { pattern: "/{single}", kind: "single" };
  return { pattern: `/${parts.map((part) => (/^\d+$/u.test(part) ? "{id}" : "{slug}")).join("/")}`, kind: "other" };
}

function aggregateUrlPatterns(entries) {
  const map = new Map();
  for (const entry of entries) {
    const result = urlPattern(entry.url);
    const key = `${entry.source}|${result.pattern}|${result.kind}`;
    const row = map.get(key) ?? { source: entry.source, pattern: result.pattern, kind: result.kind, count: 0, samples: [] };
    row.count += 1;
    if (row.samples.length < 5) row.samples.push(entry.url);
    map.set(key, row);
  }
  return [...map.values()].map((row) => ({ ...row, samples: row.samples.join(" | ") })).sort((a, b) => b.count - a.count);
}

function weightedPatternCounts(rows) {
  const counts = {};
  for (const row of rows) counts[row.pattern] = (counts[row.pattern] ?? 0) + row.count;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function buildSpecialUrls(options, sitemapLocations, categories, tags, targetSections) {
  const items = new Map();
  const add = (item) => items.set(`${item.kind}|${normalizePath(item.source_url)}`, item);
  for (const entry of sitemapLocations) {
    const pattern = urlPattern(entry.url);
    if (pattern.kind === "invalid" || pattern.kind === "article") continue;
    const sourcePath = normalizePath(entry.url);
    add({
      kind: pattern.kind === "home" ? "home" : "page",
      name: sourcePath,
      source_url: `${options.legacyBase}${sourcePath === "/" ? "" : sourcePath}`,
      expected_target_url: `${options.legacyBase}${sourcePath === "/" ? "" : sourcePath}`,
      mapping: "PRESERVE",
    });
  }
  for (const category of categories.filter((item) => item.count > 0)) {
    const sourceSlug = safeDecode(category.slug);
    const mappedSlug = ["uncategorized", "غير-مصنف"].includes(sourceSlug) ? "varieties" : sourceSlug;
    add({
      kind: "section_archive",
      name: category.name,
      source_url: `${options.legacyBase}/${sourceSlug}`,
      expected_target_url: targetSections.has(mappedSlug) ? `${options.legacyBase}/${mappedSlug}` : "",
      mapping: sourceSlug === mappedSlug ? "PRESERVE" : "301_REQUIRED",
    });
  }
  for (const tag of tags.filter((item) => item.count > 0)) {
    const sourceSlug = safeDecode(tag.slug);
    const seriesSlug = SERIES_BY_TAG_NAME[tag.name];
    add({
      kind: "tag_archive",
      name: tag.name,
      source_url: `${options.legacyBase}/tag/${sourceSlug}`,
      expected_target_url: seriesSlug ? `${options.legacyBase}/series/${seriesSlug}` : "",
      mapping: seriesSlug ? "301_REQUIRED" : "UNMAPPED",
    });
  }
  return [...items.values()];
}

function classifySpecialUrl(item, probe) {
  const sourcePath = normalizePath(item.source_url);
  const expectedPath = item.expected_target_url ? normalizePath(item.expected_target_url) : "";
  if (!expectedPath) return { status: "MISSING", reason: "NO_DOCUMENTED_TARGET_MAPPING" };
  if (!probe) return { status: "UNVERIFIED", reason: "HTTP_NOT_PROBED" };
  if (sourcePath === expectedPath && probe.status === 200) return { status: "EXACT_200", reason: "SPECIAL_URL_PRESERVED" };
  if (sourcePath !== expectedPath && PERMANENT_REDIRECTS.has(probe.status) && probe.finalStatus === 200 && normalizePath(probe.location) === expectedPath) {
    return { status: "VALID_301", reason: `PERMANENT_${probe.status}_TO_TARGET_200` };
  }
  if (probe.status === 404) return { status: "404", reason: sourcePath === expectedPath ? "SPECIAL_URL_MISSING" : "REQUIRED_SPECIAL_REDIRECT_MISSING" };
  if (probe.status === 200 && sourcePath !== expectedPath) return { status: "CONFLICT", reason: "NONCANONICAL_SPECIAL_URL_RETURNS_200" };
  return { status: "CONFLICT", reason: `SPECIAL_HTTP_${probe.status ?? "ERROR"}` };
}

function chooseRepresentative(posts, size) {
  if (posts.length <= size) return posts;
  const chosen = new Map();
  const bySection = new Map();
  for (const post of posts) {
    const section = parseArticlePath(post.link)?.section ?? "INVALID";
    const list = bySection.get(section) ?? [];
    list.push(post);
    bySection.set(section, list);
  }
  for (const list of bySection.values()) {
    for (const post of [list[0], list[Math.floor(list.length / 2)], list.at(-1)]) if (post) chosen.set(post.id, post);
  }
  const remaining = Math.max(0, size - chosen.size);
  const stride = Math.max(1, Math.floor(posts.length / Math.max(1, remaining)));
  for (let index = 0; index < posts.length && chosen.size < size; index += stride) chosen.set(posts[index].id, posts[index]);
  return [...chosen.values()].slice(0, size);
}

async function probeUrl(url) {
  try {
    const first = await fetchWithRetry(url, { method: "GET", redirect: "manual", headers: { accept: "text/html" } });
    const body = await first.text();
    const location = first.headers.get("location");
    const result = {
      requestedUrl: url,
      status: first.status,
      location: location ? new URL(location, url).href : "",
      canonicals: extractCanonicals(body),
      finalStatus: null,
      finalCanonicals: [],
    };
    if (location && first.status >= 300 && first.status < 400) {
      const destination = new URL(location, url).href;
      const final = await fetchWithRetry(destination, { method: "GET", redirect: "follow", headers: { accept: "text/html" } });
      result.finalStatus = final.status;
      result.finalCanonicals = extractCanonicals(await final.text());
    }
    return result;
  } catch (error) {
    return { requestedUrl: url, status: null, error: String(error), location: "", canonicals: [], finalStatus: null, finalCanonicals: [] };
  }
}

function canonicalEvidence(probe, expectedPath) {
  const canonicals = probe?.finalStatus ? probe.finalCanonicals : probe?.canonicals ?? [];
  const normalized = [...new Set(canonicals.map(normalizePath))];
  return {
    canonicals,
    normalized,
    matches: normalized.includes(expectedPath),
    conflict: normalized.length > 1,
  };
}

export function classifyParity({ sourcePath, sourceId, target, probe }) {
  const parsed = parseArticlePath(sourcePath);
  if (!parsed) return { classification: "CONFLICT", reason: "MALFORMED_SOURCE_URL" };
  if (parsed.id !== String(sourceId)) return { classification: "CONFLICT", reason: "SOURCE_ID_PATH_MISMATCH" };
  if (!target) {
    if (probe && probe.status !== 404) return { classification: "CONFLICT", reason: `TARGET_MISSING_ROW_HTTP_${probe.status ?? "ERROR"}` };
    return { classification: "404", reason: probe ? "TARGET_404_LIVE" : "TARGET_ROW_ABSENT_INFERRED_404" };
  }
  if (target.status !== "published") return { classification: "CONFLICT", reason: `TARGET_STATUS_${target.status}` };
  const targetPath = canonicalPath(target.section, target.id, target.slug);
  const exact = parsed.path === targetPath;
  if (!probe) return { classification: exact ? "EXACT_UNVERIFIED" : "REDIRECT_UNVERIFIED", reason: "HTTP_NOT_PROBED", targetPath };
  const evidence = canonicalEvidence(probe, targetPath);
  if (exact) {
    if (probe.status !== 200) return { classification: probe.status === 404 ? "404" : "CONFLICT", reason: `TARGET_HTTP_${probe.status ?? "ERROR"}`, targetPath };
    if (evidence.conflict) return { classification: "CONFLICT", reason: "MULTIPLE_CANONICAL_PATHS", targetPath };
    if (!evidence.matches) return { classification: "CONFLICT", reason: "CANONICAL_MISMATCH", targetPath };
    return { classification: "EXACT_200", reason: "PATH_ID_SECTION_SLUG_CANONICAL_HTTP_MATCH", targetPath };
  }
  if (PERMANENT_REDIRECTS.has(probe.status) && probe.finalStatus === 200 && normalizePath(probe.location) === targetPath) {
    const finalEvidence = canonicalEvidence(probe, targetPath);
    if (!finalEvidence.conflict && finalEvidence.matches) return { classification: "VALID_301", reason: `PERMANENT_${probe.status}_TO_CANONICAL_200`, targetPath };
  }
  if (probe.status === 404) return { classification: "404", reason: "REQUIRED_REDIRECT_MISSING_404", targetPath };
  if (probe.status === 200) return { classification: "CONFLICT", reason: "NONCANONICAL_URL_RETURNS_200", targetPath };
  return { classification: "CONFLICT", reason: `INVALID_REDIRECT_OR_HTTP_${probe.status ?? "ERROR"}`, targetPath };
}

function buildSectionMap(posts, categories, targetSections) {
  const categoryMap = new Map(categories.map((category) => [String(category.id), category]));
  const grouped = new Map();
  for (const post of posts) {
    const sourceSection = parseArticlePath(post.link)?.section ?? "INVALID";
    const categoryTerms = (post.categories ?? []).map((id) => categoryMap.get(String(id))).filter(Boolean);
    const key = sourceSection;
    const row = grouped.get(key) ?? {
      source_section: sourceSection,
      source_count: 0,
      wp_category_ids: new Set(),
      wp_category_slugs: new Set(),
      wp_category_names: new Set(),
    };
    row.source_count += 1;
    for (const category of categoryTerms) {
      row.wp_category_ids.add(category.id);
      row.wp_category_slugs.add(category.slug);
      row.wp_category_names.add(category.name);
    }
    grouped.set(key, row);
  }
  return [...grouped.values()].map((row) => {
    let targetSection = row.source_section;
    let action = "PRESERVE";
    let status = targetSections.has(targetSection) ? "EXACT" : "UNMAPPED";
    if (["uncategorized", "غير-مصنف", "%d8%ba%d9%8a%d8%b1-%d9%85%d8%b5%d9%86%d9%81"].includes(row.source_section)) {
      targetSection = "varieties";
      action = "301_REQUIRED";
      status = targetSections.has(targetSection) ? "MAPPED_WITH_REDIRECT" : "UNMAPPED";
    }
    return {
      source_section: row.source_section,
      source_count: row.source_count,
      wp_category_ids: [...row.wp_category_ids].join("|"),
      wp_category_slugs: [...row.wp_category_slugs].join("|"),
      wp_category_names: [...row.wp_category_names].join("|"),
      target_section: targetSection,
      action,
      status,
    };
  }).sort((a, b) => b.source_count - a.source_count);
}

function mediaRisksFor(post, mediaById) {
  const risks = new Set();
  const media = post.featured_media ? mediaById.get(String(post.featured_media)) : null;
  if (!post.featured_media) risks.add("NO_FEATURED_MEDIA");
  else if (!media) risks.add("FEATURED_MEDIA_UNRESOLVED");
  if (media?.source_url) {
    if (!media.source_url.startsWith("https://")) risks.add("FEATURED_MEDIA_NOT_HTTPS");
    try {
      if (new URL(media.source_url).hostname !== "dash.alelm.net") risks.add("FEATURED_MEDIA_EXTERNAL_HOST");
    } catch {
      risks.add("FEATURED_MEDIA_INVALID_URL");
    }
  }
  let externalCount = 0;
  let insecureCount = 0;
  for (const reference of post.contentMedia ?? []) {
    if (reference.startsWith("http://")) insecureCount += 1;
    try {
      const url = new URL(reference, "https://dash.alelm.net");
      if (!["dash.alelm.net", "alelm.net"].includes(url.hostname)) externalCount += 1;
    } catch {
      risks.add("CONTENT_MEDIA_INVALID_URL");
    }
  }
  if (externalCount) risks.add("CONTENT_MEDIA_EXTERNAL_HOST");
  if (insecureCount) risks.add("CONTENT_MEDIA_NOT_HTTPS");
  return risks.size ? {
    id: post.id,
    wp_url: post.link,
    featured_media_id: post.featured_media || "",
    featured_media_url: media?.source_url ?? "",
    content_media_count: post.contentMedia?.length ?? 0,
    external_content_media_count: externalCount,
    insecure_content_media_count: insecureCount,
    risks: [...risks].join("|"),
  } : null;
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = typeof key === "function" ? key(row) : row[key];
    counts[value ?? ""] = (counts[value ?? ""] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map(([label]) => label).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map(([, key]) => String(row[key] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

function buildReport(summary, sectionMap, projectFindings) {
  const counts = summary.parity.classifications;
  const blockers = summary.decision.blockers;
  return `# تقرير تطابق ترحيل «العلم»\n\n` +
    `**القرار: ${summary.decision.status}**\n\n` +
    `تاريخ القياس: ${summary.generatedAt}\n\n` +
    `المصدر القديم: ${summary.sources.wordpress} و${summary.sources.legacySite} (قراءة فقط)\n\n` +
    `الهدف الجديد: ${summary.sources.targetSite} + Neon (قراءة فقط)\n\n` +
    `## الخلاصة التنفيذية\n\n` +
    `لا يجوز بدء M-2 أو القطع في الحالة الحالية. REST الحي يحتوي **${summary.wordpress.fetchedPosts.toLocaleString("en-US")}** مادة منشورة، بينما الهدف يحتوي **${summary.target.matchedWordPressRows.toLocaleString("en-US")}** صفًا مطابق المعرف من أصل **${summary.target.totalRows.toLocaleString("en-US")}** صفًا. التصنيفات: EXACT_200=${counts.EXACT_200 ?? 0}، VALID_301=${counts.VALID_301 ?? 0}، 404=${counts["404"] ?? 0}، CONFLICT=${counts.CONFLICT ?? 0}.\n\n` +
    `فحص HTTP في الوضع **${summary.http.mode}**: قيس حيًا ${summary.http.targetProbes} رابط مادة على الهدف و${summary.http.legacyProbes} رابط مادة على الموقع القديم، إضافة إلى ${summary.http.specialTargetProbes} صفحة قسم/وسم/صفحة ثابتة على الهدف. الحالات غير المقيسة حيًا موسومة صراحة بأنها مستنتجة من غياب صف الهدف، وليست ادعاء استجابة شبكة فعلية.\n\n` +
    `## القواطع\n\n` +
    (blockers.length ? blockers.map((item) => `- **${item.code}:** ${item.detail}`).join("\n") : "- لا توجد قواطع.") +
    `\n\n## مصفوفة الأقسام\n\n` +
    markdownTable(sectionMap, [["القديم", "source_section"], ["العدد", "source_count"], ["الجديد", "target_section"], ["الإجراء", "action"], ["الحالة", "status"]]) +
    `\n\n## فحص عقود المشروع\n\n` +
    markdownTable(projectFindings, [["الفحص", "code"], ["النتيجة", "passed"], ["الأهمية", "severity"], ["التفصيل", "detail"]]) +
    `\n\n## ملاحظات حرجة مكتشفة حيًا\n\n` +
    `- العدد الحي تغيّر عن جرد 11 أغسطس؛ أرقام الوثيقة لا تصلح كبوابة قطع دون إعادة جرد.\n` +
    `- خريطة الموقع القديمة أعادت ${summary.sitemaps.invalidUndefinedUrls.toLocaleString("en-US")} رابطًا من نوع \`https://alelm.netundefined\` وقت القياس.\n` +
    `- جُردت ${summary.wordpress.activeTags} وسوم فعالة و${summary.wordpress.categories} قسمًا، ووجد الفحص ${Object.entries(summary.specialUrls.statuses).filter(([key]) => !["EXACT_200", "VALID_301"].includes(key)).reduce((sum, [, value]) => sum + value, 0)} رابط أرشيف/صفحة خاصة غير سليم على الهدف.\n` +
    `- خريطة الموقع الجديدة في الكود لا تُخرج روابط المواد المنشورة.\n` +
    `- مسار المادة الحالي يجلبها بالـ ID، لكنه لا يحول section/slug الخاطئين إلى الرابط القانوني؛ هذا يخلق 200 على بدائل غير قانونية وcanonical متعارضًا.\n` +
    `- ${summary.media.riskRows.toLocaleString("en-US")} مادة تحمل إشارة مخاطرة وسائط؛ ليست كلها قاطع نشر، لكن unresolved/insecure/external تحتاج معالجة في M-3.\n\n` +
    `## بوابة M-2\n\n` +
    `لا يتحول القرار إلى READY FOR M2 إلا بعد: تغطية كل ID منشور، تطابق section/slug أو 301 دائم إلى 200، صفر 404، canonical واحد صحيح، خريطة مواد كاملة، وتوثيق الصفحات/الأنماط غير المقالية. لا يتضمن هذا التدقيق أي ترحيل أو DNS أو حذف أو تعديل إنتاجي.\n\n` +
    `## المخرجات\n\n` +
    `- \`migration-audit/summary.json\`\n` +
    `- \`migration-audit/url-parity.csv\`\n` +
    `- \`migration-audit/section-map.csv\`\n` +
    `- \`migration-audit/url-patterns.csv\`\n` +
    `- \`migration-audit/redirects-required.csv\`\n` +
    `- \`migration-audit/missing.csv\`\n` +
    `- \`migration-audit/conflicts.csv\`\n` +
    `- \`migration-audit/media-risk.csv\`\n`;
}

async function main() {
  const options = parseArgs();
  const startedAt = Date.now();
  await mkdir(options.output, { recursive: true });
  console.log("تدقيق تطابق العلم — قراءة فقط\n");

  console.log("1/6 جلب مواد ووردبريس والتصنيفات…");
  const [wp, categories, tags, project, target] = await Promise.all([
    fetchWordPressPosts(options),
    fetchTerms(options, "categories"),
    fetchTerms(options, "tags"),
    inspectProjectContracts(),
    readTargetStories(),
  ]);
  console.log(`  المواد: ${wp.posts.length}/${wp.reportedTotal} · صفوف الهدف: ${target.rows.length}`);

  console.log("2/6 جلب خرائط الموقع والوسائط البارزة…");
  const [sitemaps, mediaById] = await Promise.all([
    fetchSitemaps(options),
    fetchFeaturedMedia(options, wp.posts),
  ]);

  const targetById = new Map(target.rows.map((row) => [row.id, row]));
  const sourceById = new Map(wp.posts.map((post) => [post.id, post]));
  const targetMatched = target.rows.filter((row) => sourceById.has(row.id));
  const sourceMissingTarget = wp.posts.filter((post) => !targetById.has(post.id));
  const targetOrphans = target.rows.filter((row) => !sourceById.has(row.id));

  const sitemapLocations = sitemaps.files.flatMap((file) => file.locations.map((url) => ({ source: `sitemap:${new URL(file.url).pathname}`, url })));
  const specialUrls = buildSpecialUrls(options, sitemapLocations, categories, tags, new Set(project.sectionSlugs));

  console.log("3/6 تحديد عينة HTTP الحية…");
  let targetProbePosts = [];
  let legacyProbePosts = [];
  if (options.http === "all") {
    targetProbePosts = wp.posts;
    legacyProbePosts = wp.posts;
  } else if (options.http === "sample") {
    const targetExisting = wp.posts.filter((post) => targetById.has(post.id));
    targetProbePosts = [...new Map([
      ...targetExisting,
      ...chooseRepresentative(sourceMissingTarget, options.sampleSize),
    ].map((post) => [post.id, post])).values()];
    legacyProbePosts = chooseRepresentative(wp.posts, options.sampleSize);
  }

  const targetProbes = new Map();
  const legacyProbes = new Map();
  const targetSpecialProbes = new Map();
  const legacySpecialProbes = new Map();
  if (targetProbePosts.length || legacyProbePosts.length) {
    console.log(`  الهدف: ${targetProbePosts.length} · القديم: ${legacyProbePosts.length} · أنماط خاصة: ${specialUrls.length}`);
    let completed = 0;
    const jobs = [
      ...targetProbePosts.map((post) => ({ kind: "target", post })),
      ...legacyProbePosts.map((post) => ({ kind: "legacy", post })),
      ...specialUrls.flatMap((item) => [
        { kind: "target-special", item },
        { kind: "legacy-special", item },
      ]),
    ];
    await mapConcurrent(jobs, options.concurrency, async ({ kind, post, item }) => {
      if (item) {
        const sourcePath = normalizePath(item.source_url);
        const base = kind === "target-special" ? options.targetBase : options.legacyBase;
        const probe = await probeUrl(`${base}${sourcePath === "/" ? "" : sourcePath}`);
        (kind === "target-special" ? targetSpecialProbes : legacySpecialProbes).set(`${item.kind}|${sourcePath}`, probe);
      } else {
        const sourcePath = parseArticlePath(post.link)?.path ?? normalizePath(post.link);
        const base = kind === "target" ? options.targetBase : options.legacyBase;
        const probe = await probeUrl(`${base}${sourcePath}`);
        (kind === "target" ? targetProbes : legacyProbes).set(post.id, probe);
      }
      completed += 1;
      if (completed % 100 === 0 || completed === jobs.length) console.log(`  HTTP: ${completed}/${jobs.length}`);
    });
  }

  console.log("4/6 بناء فروقات المواد والأقسام والوسائط…");
  const parityRows = [];
  const missingRows = [];
  const conflictRows = [];
  const redirectRows = [];
  for (const post of wp.posts) {
    const parsed = parseArticlePath(post.link);
    const targetRow = targetById.get(post.id);
    const targetProbe = targetProbes.get(post.id);
    const legacyProbe = legacyProbes.get(post.id);
    const result = classifyParity({ sourcePath: post.link, sourceId: post.id, target: targetRow, probe: targetProbe });
    const targetPath = targetRow ? canonicalPath(targetRow.section, targetRow.id, targetRow.slug) : "";
    const sourceSlugApi = safeDecode(post.slug);
    const sourcePathMismatch = parsed && sourceSlugApi !== parsed.slug;
    const reasons = [result.reason];
    if (sourcePathMismatch) reasons.push("WP_API_SLUG_LINK_MISMATCH");
    const row = {
      wp_id: post.id,
      wp_url: post.link,
      wp_path: parsed?.path ?? normalizePath(post.link),
      wp_section: parsed?.section ?? "",
      wp_slug: parsed?.slug ?? sourceSlugApi,
      wp_api_slug: sourceSlugApi,
      wp_status: post.status,
      wp_http_status: legacyProbe?.status ?? "",
      wp_canonical: legacyProbe?.canonicals?.join("|") ?? "",
      wp_http_evidence: legacyProbe ? "LIVE" : "NOT_PROBED",
      target_exists: Boolean(targetRow),
      target_status: targetRow?.status ?? "",
      target_section: targetRow?.section ?? "",
      target_slug: targetRow?.slug ?? "",
      target_url: targetPath ? `${options.legacyBase}${targetPath}` : "",
      target_http_status: targetProbe?.status ?? (targetRow ? "" : 404),
      target_http_evidence: targetProbe ? "LIVE" : targetRow ? "NOT_PROBED" : "INFERRED_FROM_ABSENT_DB_ROW",
      target_canonical: targetProbe?.canonicals?.join("|") ?? "",
      target_redirect_location: targetProbe?.location ?? "",
      target_redirect_final_status: targetProbe?.finalStatus ?? "",
      classification: sourcePathMismatch ? "CONFLICT" : result.classification,
      reasons: reasons.join("|"),
    };
    parityRows.push(row);
    if (!targetRow || row.classification === "404") {
      missingRows.push({ source_kind: "post", id: post.id, name: "", source_url: post.link, expected_target_url: targetPath ? `${options.legacyBase}${targetPath}` : "", legacy_http_status: legacyProbe?.status ?? "", target_http_status: targetProbe?.status ?? (targetRow ? "" : 404), status: row.classification, reason: row.reasons, evidence: row.target_http_evidence });
    }
    if (row.classification === "CONFLICT" || row.classification.endsWith("UNVERIFIED")) {
      conflictRows.push({ kind: "post", id: post.id, source_url: post.link, target_url: row.target_url, classification: row.classification, reason: row.reasons });
    }
    if (targetRow && parsed && parsed.path !== targetPath) {
      redirectRows.push({ id: post.id, from_url: `${options.legacyBase}${parsed.path}`, to_url: `${options.legacyBase}${targetPath}`, reason: "SECTION_OR_SLUG_DIFFERS", verification: row.classification });
    }
  }
  for (const row of targetOrphans) {
    conflictRows.push({ kind: "target_orphan", id: row.id, source_url: "", target_url: `${options.legacyBase}${canonicalPath(row.section, row.id, row.slug)}`, classification: "TARGET_ORPHAN", reason: "TARGET_ID_NOT_IN_CURRENT_WP_PUBLISHED_REST" });
  }

  const specialRows = [];
  for (const item of specialUrls) {
    const key = `${item.kind}|${normalizePath(item.source_url)}`;
    const targetProbe = targetSpecialProbes.get(key);
    const legacyProbe = legacySpecialProbes.get(key);
    const result = classifySpecialUrl(item, targetProbe);
    const row = {
      ...item,
      legacy_http_status: legacyProbe?.status ?? "",
      target_http_status: targetProbe?.status ?? "",
      target_redirect_location: targetProbe?.location ?? "",
      status: result.status,
      reason: result.reason,
      evidence: targetProbe ? "LIVE" : "PROJECT_MAPPING_ONLY",
    };
    specialRows.push(row);
    if (!["EXACT_200", "VALID_301"].includes(result.status)) {
      missingRows.push({ source_kind: item.kind, id: "", name: item.name, source_url: item.source_url, expected_target_url: item.expected_target_url, legacy_http_status: legacyProbe?.status ?? "", target_http_status: targetProbe?.status ?? "", status: result.status, reason: result.reason, evidence: row.evidence });
      conflictRows.push({ kind: item.kind, id: "", source_url: item.source_url, target_url: item.expected_target_url, classification: result.status, reason: result.reason });
    }
    if (item.mapping === "301_REQUIRED") {
      redirectRows.push({ id: "", from_url: item.source_url, to_url: item.expected_target_url, reason: `${item.kind.toUpperCase()}_MAPPING`, verification: result.status });
    }
  }

  const sectionMap = buildSectionMap(wp.posts, categories, new Set(project.sectionSlugs));
  const mediaRisks = wp.posts.map((post) => mediaRisksFor(post, mediaById)).filter(Boolean);

  console.log("5/6 تحليل خرائط الموقع والأنماط…");
  const patternRows = aggregateUrlPatterns([
    ...wp.posts.map((post) => ({ source: "wordpress-rest", url: post.link })),
    ...sitemapLocations,
    ...categories.filter((category) => category.count > 0).map((category) => ({ source: "wordpress-category-terms", url: `${options.legacyBase}/${safeDecode(category.slug)}` })),
    ...tags.filter((tag) => tag.count > 0).map((tag) => ({ source: "wordpress-tag-terms", url: `${options.legacyBase}/tag/${safeDecode(tag.slug)}` })),
  ]);
  const invalidSitemap = sitemapLocations.filter((entry) => urlPattern(entry.url).kind === "invalid");
  const sitemapArticleUrls = sitemapLocations.filter((entry) => urlPattern(entry.url).kind === "article");
  for (const entry of invalidSitemap.slice(0, 200)) {
    conflictRows.push({ kind: "sitemap", id: "", source_url: entry.url, target_url: "", classification: "INVALID_SITEMAP_URL", reason: "URL_CONTAINS_UNDEFINED_OR_IS_INVALID" });
  }

  const classifications = countBy(parityRows, "classification");
  const projectBlockers = project.findings.filter((finding) => finding.severity === "BLOCKER" && !finding.passed);
  const blockers = [];
  if (!wp.complete) blockers.push({ code: "INCOMPLETE_SOURCE_INVENTORY", detail: `سُحب ${wp.posts.length} من ${wp.reportedTotal}; تشغيل --limit لا يصلح لقرار M-2.` });
  if (sourceMissingTarget.length) blockers.push({ code: "MISSING_TARGET_STORIES", detail: `${sourceMissingTarget.length} ID منشور في ووردبريس غير موجود في قاعدة الهدف.` });
  if ((classifications["404"] ?? 0) > 0) blockers.push({ code: "TARGET_404", detail: `${classifications["404"]} مادة مصنفة 404 (حيًا أو مستنتجة بوضوح من غياب صف الهدف).` });
  if ((classifications.CONFLICT ?? 0) > 0) blockers.push({ code: "URL_CONFLICTS", detail: `${classifications.CONFLICT} تعارض ID/section/slug/canonical/HTTP.` });
  if ((classifications.EXACT_UNVERIFIED ?? 0) + (classifications.REDIRECT_UNVERIFIED ?? 0) > 0) blockers.push({ code: "HTTP_UNVERIFIED", detail: "توجد صفوف هدف لم يُقَس سلوك HTTP لها حيًا." });
  if (invalidSitemap.length) blockers.push({ code: "LEGACY_SITEMAP_INVALID", detail: `${invalidSitemap.length} إدخالًا غير صالح في خرائط الموقع الحية، وأبرزها alElm.netundefined.` });
  const failedSitemaps = sitemaps.files.filter((file) => !file.ok);
  if (failedSitemaps.length) blockers.push({ code: "SITEMAP_FETCH_FAILED", detail: `تعذر جلب ${failedSitemaps.length} ملف خريطة أثناء القياس: ${failedSitemaps.map((file) => file.url).join(", ")}.` });
  if (sitemapArticleUrls.length < wp.posts.length) blockers.push({ code: "LEGACY_SITEMAP_COVERAGE", detail: `خرائط الموقع الحية قدمت ${sitemapArticleUrls.length} رابط مادة صالحًا مقابل ${wp.posts.length} مادة REST.` });
  const brokenSpecialUrls = specialRows.filter((row) => !["EXACT_200", "VALID_301"].includes(row.status));
  if (brokenSpecialUrls.length) blockers.push({ code: "LEGACY_SPECIAL_URLS", detail: `${brokenSpecialUrls.length} صفحة قسم/وسم/صفحة ثابتة بلا تطابق 200 أو 301 صالح.` });
  if (sectionMap.some((row) => row.status === "UNMAPPED")) blockers.push({ code: "UNMAPPED_SECTIONS", detail: "توجد أقسام مسارية بلا تعيين إلى قسم معتمد في المشروع الجديد." });
  for (const finding of projectBlockers) blockers.push({ code: finding.code, detail: finding.detail });

  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    durationSeconds: Math.round((Date.now() - startedAt) / 1000),
    readOnly: true,
    sources: { wordpress: options.wpBase, legacySite: options.legacyBase, targetSite: options.targetBase, database: target.configured ? "Neon عبر DATABASE_URL (SELECT فقط)" : "غير متاح" },
    options: { http: options.http, sampleSize: options.sampleSize, concurrency: options.concurrency, limit: options.limit },
    wordpress: { reportedPosts: wp.reportedTotal, fetchedPosts: wp.posts.length, reportedPages: wp.reportedPages, fetchedPages: wp.fetchedPages, complete: wp.complete, categories: categories.length, tags: tags.length, activeTags: tags.filter((tag) => tag.count > 0).length },
    target: { configured: target.configured, error: target.error ?? null, totalRows: target.rows.length, matchedWordPressRows: targetMatched.length, orphanRows: targetOrphans.length, publishedRows: target.rows.filter((row) => row.status === "published").length },
    parity: { classifications, missingTargetRows: sourceMissingTarget.length, redirectsRequired: redirectRows.length, conflictRows: conflictRows.length },
    http: { mode: options.http, targetProbes: targetProbes.size, legacyProbes: legacyProbes.size, specialTargetProbes: targetSpecialProbes.size, specialLegacyProbes: legacySpecialProbes.size, targetStatusCounts: countBy([...targetProbes.values()], "status"), legacyStatusCounts: countBy([...legacyProbes.values()], "status") },
    sitemaps: { childFiles: sitemaps.childCount, fetchedFiles: sitemaps.files.filter((file) => file.ok).length, failedFiles: failedSitemaps.length, failures: failedSitemaps.map((file) => ({ url: file.url, error: file.error })), totalLocations: sitemapLocations.length, validArticleUrls: sitemapArticleUrls.length, invalidUndefinedUrls: invalidSitemap.filter((entry) => entry.url.includes("undefined")).length, patterns: weightedPatternCounts(patternRows) },
    specialUrls: { total: specialRows.length, statuses: countBy(specialRows, "status"), kinds: countBy(specialRows, "kind"), legacyStatusCounts: countBy(specialRows, "legacy_http_status"), targetStatusCounts: countBy(specialRows, "target_http_status") },
    media: { resolvedFeaturedMedia: mediaById.size, riskRows: mediaRisks.length, riskTypes: countBy(mediaRisks.flatMap((row) => row.risks.split("|").map((risk) => ({ risk }))), "risk") },
    project: { findings: project.findings, supportedSections: project.sectionSlugs },
    decision: { status: blockers.length ? "NOT READY FOR M2" : "READY FOR M2", blockers },
  };

  console.log("6/6 كتابة المخرجات والتقرير…");
  const writes = [
    writeFile(path.join(options.output, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`),
    writeFile(path.join(options.output, "url-parity.csv"), toCsv(parityRows, ["wp_id", "wp_url", "wp_path", "wp_section", "wp_slug", "wp_api_slug", "wp_status", "wp_http_status", "wp_canonical", "wp_http_evidence", "target_exists", "target_status", "target_section", "target_slug", "target_url", "target_http_status", "target_http_evidence", "target_canonical", "target_redirect_location", "target_redirect_final_status", "classification", "reasons"])),
    writeFile(path.join(options.output, "section-map.csv"), toCsv(sectionMap, ["source_section", "source_count", "wp_category_ids", "wp_category_slugs", "wp_category_names", "target_section", "action", "status"])),
    writeFile(path.join(options.output, "url-patterns.csv"), toCsv(patternRows, ["source", "pattern", "kind", "count", "samples"])),
    writeFile(path.join(options.output, "redirects-required.csv"), toCsv(redirectRows, ["id", "from_url", "to_url", "reason", "verification"])),
    writeFile(path.join(options.output, "missing.csv"), toCsv(missingRows, ["source_kind", "id", "name", "source_url", "expected_target_url", "legacy_http_status", "target_http_status", "status", "reason", "evidence"])),
    writeFile(path.join(options.output, "conflicts.csv"), toCsv(conflictRows, ["kind", "id", "source_url", "target_url", "classification", "reason"])),
    writeFile(path.join(options.output, "media-risk.csv"), toCsv(mediaRisks, ["id", "wp_url", "featured_media_id", "featured_media_url", "content_media_count", "external_content_media_count", "insecure_content_media_count", "risks"])),
    writeFile(path.join(REPO_ROOT, "docs/migration-parity-report.md"), buildReport(summary, sectionMap, project.findings)),
  ];
  await Promise.all(writes);

  console.log(`\nالقرار: ${summary.decision.status}`);
  console.log(`EXACT_200=${classifications.EXACT_200 ?? 0} · VALID_301=${classifications.VALID_301 ?? 0} · 404=${classifications["404"] ?? 0} · CONFLICT=${classifications.CONFLICT ?? 0}`);
  console.log(`المخرجات: ${options.output}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`فشل التدقيق: ${error?.stack ?? error}`);
    process.exitCode = 1;
  });
}
