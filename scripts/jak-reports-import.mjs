#!/usr/bin/env node
/**
 * استيراد أحدث أربعة تقارير جاك HTML/CSS أو الأرشيف الكامل باستخدام --all.
 * التشغيل الافتراضي بروفة قراءة فقط؛ استخدم --apply للكتابة المحلية.
 * لا تُنقل الصور في هذه المرحلة، وتبقى روابط المصدر كما هي.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import pg from "pg";

const SOURCE = "https://jakelelm.alelm.net/wp-json/wp/v2/posts";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const all = args.includes("--all");
const publish = args.includes("--publish");
const allowRemote = args.includes("--allow-remote");
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_CSS_BYTES = 1024 * 1024;
// Use the same bounded page size as the existing latest4 flow so --all exercises
// every WordPress page and can detect a truncated response.
const PER_PAGE = 4;
const RAW_SNAPSHOT_PATH = "/tmp/jak-all-source.json";
const MANIFEST_PATH = "/tmp/jak-all-manifest.json";

function log(message) { console.log(`[jak-import] ${message}`); }
function text(value) { return typeof value === "string" ? value : ""; }
function decodeEntities(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—" };
  return value.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match);
}
function stripHtml(value) {
  return decodeEntities(value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/gu, " ").trim();
}
function pickRawWithSource(post, key, fallbackKey, fallback = "") {
  for (const [source, value] of [["meta", post?.meta?.[key]], ["post", post?.[key]], ["acf", post?.acf?.[key]]]) {
    if (typeof value === "string") return { value, source: `${source}.${key}` };
  }
  return { value: fallback, source: fallbackKey };
}
function flag(value) { return value === true || value === 1 || value === "1" || value === "true"; }
function slugFor(post, title, id) {
  let source = text(post?.slug) || title;
  try { source = decodeURIComponent(source); } catch { /* keep the source slug when malformed */ }
  const slug = decodeEntities(source).normalize("NFC").trim().toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 200);
  return slug || `jak-${id}`;
}
function sourceHash(html, css) {
  return createHash("sha256").update(html).update("\0").update(css).digest("hex");
}
function localDatabase(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
  } catch { return false; }
}
function urlPath(value) {
  try { return new URL(value).pathname; } catch { return null; }
}
function valuesFromMarkup(markup, tag, attribute) {
  const out = [];
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attribute}=["']([^"']+)["'][^>]*>`, "gi");
  for (const match of markup.matchAll(re)) out.push(match[1]);
  return [...new Set(out)];
}
function markupInventory(html, sourceUrl) {
  const scripts = valuesFromMarkup(html, "script", "src");
  const styles = valuesFromMarkup(html, "link", "href").filter((value) => /stylesheet|\.css(?:$|[?#])/i.test(value));
  const inlineScripts = (html.match(/<script\b(?![^>]*\bsrc=)/gi) ?? []).length;
  const inlineStyles = (html.match(/<style\b/gi) ?? []).length;
  const assets = [
    ...scripts,
    ...styles,
    ...[...html.matchAll(/(?:src|href|poster)=["']([^"']+)["']/gi)].map((match) => match[1]),
    ...[...html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((match) => match[1]),
  ];
  const origins = new Set();
  for (const asset of assets) {
    try { origins.add(new URL(asset, sourceUrl || SOURCE).origin); } catch { /* Ignore non-URL asset references. */ }
  }
  const oxygenMarkers = [...new Set((html.match(/[^"'\s]*(?:oxygen|ct-builder|oxy-)[^"'\s]*/gi) ?? []).slice(0, 20))];
  const globalScriptReferences = [...new Set((html.match(/\b(?:gsap|ScrollTrigger|TweenMax|Oxygen|CTFrontendBuilder)\b/gi) ?? []).map((value) => value.toLowerCase()))];
  return {
    scripts: [...scripts, ...(inlineScripts ? [`inline:${inlineScripts}`] : [])],
    styles: [...styles, ...(inlineStyles ? [`inline:${inlineStyles}`] : [])],
    assetOrigins: [...origins].sort(),
    oxygenDependencies: oxygenMarkers,
    globalScriptReferences,
  };
}
function reportFromPost(post) {
  const id = Number(post?.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("منشور جاك بلا معرّف صحيح.");
  const title = stripHtml(text(post?.title?.rendered) || text(post?.title));
  const htmlField = pickRawWithSource(post, "custom_html", "content.rendered", text(post?.content?.rendered));
  const cssField = pickRawWithSource(post, "custom_css", "custom_css", "");
  const html = htmlField.value;
  const css = cssField.value;
  if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) throw new Error(`HTML للمنشور ${id} يتجاوز 2MB`);
  if (new TextEncoder().encode(css).byteLength > MAX_CSS_BYTES) throw new Error(`CSS للمنشور ${id} يتجاوز 1MB`);
  const sourceUrl = text(post?.link) || null;
  const featured = post?._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  const image = text(featured) || text(post?.jetpack_featured_media_url) || null;
  const rawFlag = post?.meta?.show_on_homepage ?? post?.acf?.show_on_homepage ?? post?.show_on_homepage;
  const inventory = markupInventory(html, sourceUrl);
  return {
    id,
    slug: slugFor(post, title, id),
    title: title || `تقرير جاك ${id}`,
    excerpt: stripHtml(text(post?.excerpt?.rendered) || html).slice(0, 240),
    image,
    html,
    css,
    htmlSource: htmlField.source,
    cssSource: cssField.source,
    showOnHomepage: flag(rawFlag),
    showFlagPresent: rawFlag !== undefined && rawFlag !== null,
    sourceUrl,
    sourcePath: urlPath(sourceUrl),
    sourcePublishedAt: text(post?.date_gmt) || text(post?.date) || null,
    sourceModifiedAt: text(post?.modified_gmt) || text(post?.modified) || null,
    hash: sourceHash(html, css),
    inventory,
  };
}
const FETCH_HEADERS = { "User-Agent": "alelm-jak-code-import/1.0 (read-only)" };
async function fetchJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: FETCH_HEADERS });
  if (!response.ok) throw new Error(`مصدر جاك أعاد HTTP ${response.status}`);
  const posts = await response.json();
  if (!Array.isArray(posts)) throw new Error("استجابة مصدر جاك ليست قائمة منشورات.");
  return { posts, total: Number(response.headers.get("x-wp-total")), totalPages: Number(response.headers.get("x-wp-totalpages")) };
}
export async function fetchPosts(fetchImpl = fetch) {
  const result = await fetchJson(`${SOURCE}?status=publish&per_page=4&orderby=date&order=desc&_embed=1`, fetchImpl);
  if (!Number.isInteger(result.total) || result.total < 4) throw new Error(`مصدر جاك أعلن إجماليًا غير متوقع: ${result.total}`);
  return result.posts.slice(0, 4).map(reportFromPost);
}
export async function fetchAllPosts(fetchImpl = fetch) {
  const first = await fetchJson(`${SOURCE}?status=publish&per_page=${PER_PAGE}&page=1&orderby=date&order=desc&_embed=1`, fetchImpl);
  if (!Number.isInteger(first.total) || first.total < 0) throw new Error(`مصدر جاك لم يرسل x-wp-total صحيحًا: ${first.total}`);
  const pages = Number.isInteger(first.totalPages) && first.totalPages > 0 ? first.totalPages : Math.ceil(first.total / PER_PAGE);
  const rawPosts = [...first.posts];
  for (let page = 2; page <= pages; page += 1) {
    const result = await fetchJson(`${SOURCE}?status=publish&per_page=${PER_PAGE}&page=${page}&orderby=date&order=desc&_embed=1`, fetchImpl);
    if (result.total !== first.total) throw new Error(`تغير x-wp-total أثناء pagination: ${first.total} ثم ${result.total}`);
    rawPosts.push(...result.posts);
  }
  const ids = rawPosts.map((post) => Number(post?.id));
  if (rawPosts.length !== first.total || new Set(ids).size !== first.total) {
    throw new Error(`اكتملت pagination لكن العدد الفعلي ${rawPosts.length} والمنشورات الفريدة ${new Set(ids).size} لا يطابقان x-wp-total=${first.total}`);
  }
  return { rawPosts, reports: rawPosts.map(reportFromPost), total: first.total, totalPages: pages };
}
export function buildManifest(reports, { total, totalPages, fetchedAt = new Date().toISOString() } = {}) {
  return {
    source: SOURCE,
    fetchedAt,
    total,
    totalPages,
    reports: reports.map((report) => ({
      sourceId: report.id,
      sourceUrl: report.sourceUrl,
      sourcePath: report.sourcePath ?? urlPath(report.sourceUrl),
      title: report.title,
      htmlSource: report.htmlSource,
      htmlBytes: new TextEncoder().encode(report.html).byteLength,
      cssSource: report.cssSource,
      cssBytes: new TextEncoder().encode(report.css).byteLength,
      scripts: report.inventory.scripts,
      styles: report.inventory.styles,
      assetOrigins: report.inventory.assetOrigins,
      oxygenDependencies: report.inventory.oxygenDependencies,
      globalScriptReferences: report.inventory.globalScriptReferences,
      showFlagPresent: report.showFlagPresent,
      showOnHomepage: report.showOnHomepage,
    })),
  };
}
async function saveInventory(rawPosts, reports, total, totalPages) {
  await mkdir("/tmp", { recursive: true });
  await writeFile(RAW_SNAPSHOT_PATH, `${JSON.stringify(rawPosts, null, 2)}\n`, "utf8");
  await writeFile(MANIFEST_PATH, `${JSON.stringify(buildManifest(reports, { total, totalPages }), null, 2)}\n`, "utf8");
  log(`حُفظت لقطة المصدر في ${RAW_SNAPSHOT_PATH} وmanifest في ${MANIFEST_PATH}.`);
}

export function dedupeDecision(existing, report) {
  if (!existing) return "insert";
  if (existing.html === report.html && existing.css === report.css) return "skip-unchanged";
  return "skip-conflict";
}

async function main() {
  const source = all ? await fetchAllPosts() : { reports: await fetchPosts(), total: 4, totalPages: 1, rawPosts: null };
  const reports = source.reports;
  if (reports.length !== (all ? source.total : 4)) throw new Error(`المصدر أعاد ${reports.length} تقارير بدل العدد المتوقع؛ أوقف الاستيراد للمراجعة.`);
  if (all) await saveInventory(source.rawPosts, reports, source.total, source.totalPages);
  log(`${apply ? "apply" : "dry-run"}: ${reports.length} تقارير من المصدر (الوضع ${all ? "all" : "latest4"}).`);
  for (const report of reports) log(`${report.id} ${report.title} — html ${new TextEncoder().encode(report.html).byteLength}B, css ${new TextEncoder().encode(report.css).byteLength}B, sha256 ${report.hash}`);
  const fallback = reports.filter((report) => report.htmlSource !== "meta.custom_html");
  const oxygen = reports.filter((report) => report.inventory.oxygenDependencies.length || report.inventory.globalScriptReferences.length);
  if (fallback.length) log(`تنبيه تدقيق: ${fallback.length} تقارير لا تستخدم meta.custom_html: ${fallback.map((report) => `${report.id} (${report.htmlSource})`).join(", ")}`);
  if (oxygen.length) log(`تبعيات Oxygen/GSAP أو سكربتات عامة: ${oxygen.map((report) => `${report.id} [${[...report.inventory.oxygenDependencies, ...report.inventory.globalScriptReferences].join(", ")}]`).join("; ")}`);
  if (!apply) return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL غير مضبوط — التشغيل الافتراضي بروفة؛ استخدم قاعدة محلية مع --apply.");
  if (!allowRemote && !localDatabase(databaseUrl)) throw new Error("--apply مسموح محليًا فقط؛ استخدم --allow-remote صراحةً للتشغيل البعيد.");

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const now = new Date().toISOString();
  let inserted = 0;
  let skippedUnchanged = 0;
  let skippedConflict = 0;
  try {
    await client.query("begin");
    for (const report of reports) {
      const existing = await client.query("select id, html, css, status from jak_code_reports where source_post_id = $1 limit 1", [report.id]);
      if (publish && existing.rows[0] && existing.rows[0].status !== "published") {
        throw new Error(`المنشور ${report.id} موجود بحالة ${existing.rows[0].status}؛ انشره عبر انتقال التحرير المعتمد قبل إعادة الاستيراد. لم تُغيّر حالته تلقائيًا.`);
      }
      const decision = dedupeDecision(existing.rows[0], report);
      if (decision === "skip-unchanged") { skippedUnchanged += 1; continue; }
      if (decision === "skip-conflict") {
        skippedConflict += 1;
        log(`تجاوز منشور ${report.id}: النسخة المحلية مختلفة، ولم يُستبدل محتوى محرر.`);
        continue;
      }
      const result = await client.query(`insert into jak_code_reports
        (id, slug, title, excerpt, image, html, css, show_on_homepage, status, author_id, version, created_at, updated_at, published_at, source_url, source_post_id, source_published_at, source_modified_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, null, 1, $10, $10, $11, $12, $13, $14, $15)
        on conflict do nothing returning id`, [randomUUID(), report.slug, report.title, report.excerpt, report.image, report.html, report.css, report.showOnHomepage ? 1 : 0, publish ? "published" : "draft", now, publish ? (report.sourcePublishedAt || now) : null, report.sourceUrl, report.id, report.sourcePublishedAt, report.sourceModifiedAt]);
      if (!result.rowCount) { skippedConflict += 1; continue; }
      inserted += 1;
      await client.query(`insert into audit_log (id, at, actor, action, story_id, detail, context)
        values ($1, $2, 'jak-import', $3, $4, $5, $6::jsonb)`, [randomUUID(), now, publish ? "jak:report-import-publish" : "jak:report-import", result.rows[0].id, publish ? "استيراد ونشر صريح من المصدر" : "استيراد مسودة من المصدر", JSON.stringify({ sourcePostId: report.id, sourceUrl: report.sourceUrl, sourcePublishedAt: report.sourcePublishedAt, sourceModifiedAt: report.sourceModifiedAt, sourceHash: report.hash })]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
  log(`تم إدراج ${inserted} ${publish ? "تقارير منشورة" : "مسودات"} وتجاوز ${skippedUnchanged} مطابقة بلا تغيير و${skippedConflict} متعارضة في معاملة واحدة.`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main().catch((error) => { console.error(`[jak-import] فشل: ${error.message}`); process.exitCode = 1; });
