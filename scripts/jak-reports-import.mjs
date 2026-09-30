#!/usr/bin/env node
/**
 * استيراد أحدث أربعة تقارير جاك HTML/CSS إلى جدول مستقل.
 * التشغيل الافتراضي بروفة قراءة فقط؛ استخدم --apply للكتابة المحلية.
 * لا تُنقل الصور في هذه المرحلة، وتبقى روابط المصدر كما هي.
 */
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";

const SOURCE = "https://jakelelm.alelm.net/wp-json/wp/v2/posts";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const publish = args.includes("--publish");
const allowRemote = args.includes("--allow-remote");
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_CSS_BYTES = 1024 * 1024;

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
function pickRaw(post, key, fallback = "") {
  return [post?.meta?.[key], post?.[key], post?.acf?.[key]].find((value) => typeof value === "string") ?? fallback;
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
async function fetchPosts() {
  const url = `${SOURCE}?status=publish&per_page=4&orderby=date&order=desc&_embed=1`;
  const response = await fetch(url, { headers: { "User-Agent": "alelm-jak-code-import/1.0 (read-only)" } });
  if (!response.ok) throw new Error(`مصدر جاك أعاد HTTP ${response.status}`);
  const posts = await response.json();
  if (!Array.isArray(posts)) throw new Error("استجابة مصدر جاك ليست قائمة منشورات.");
  return posts.slice(0, 4).map((post) => {
    const id = Number(post?.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error("منشور جاك بلا معرّف صحيح.");
    const title = stripHtml(text(post?.title?.rendered) || text(post?.title));
    const html = pickRaw(post, "custom_html", text(post?.content?.rendered));
    const css = pickRaw(post, "custom_css");
    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) throw new Error(`HTML للمنشور ${id} يتجاوز 2MB`);
    if (new TextEncoder().encode(css).byteLength > MAX_CSS_BYTES) throw new Error(`CSS للمنشور ${id} يتجاوز 1MB`);
    const featured = post?._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
    const image = text(featured) || text(post?.jetpack_featured_media_url) || null;
    return {
      id,
      slug: slugFor(post, title, id),
      title: title || `تقرير جاك ${id}`,
      excerpt: stripHtml(text(post?.excerpt?.rendered) || html).slice(0, 240),
      image,
      html,
      css,
      showOnHomepage: flag(post?.meta?.show_on_homepage ?? post?.acf?.show_on_homepage),
      sourceUrl: text(post?.link) || null,
      sourcePublishedAt: text(post?.date_gmt) || text(post?.date) || null,
      sourceModifiedAt: text(post?.modified_gmt) || text(post?.modified) || null,
      hash: sourceHash(html, css),
    };
  });
}

async function main() {
  const reports = await fetchPosts();
  if (reports.length !== 4) throw new Error(`المصدر أعاد ${reports.length} تقارير بدل أحدث 4؛ أوقف الاستيراد للمراجعة.`);
  log(`${apply ? "apply" : "dry-run"}: ${reports.length} تقارير من المصدر (المتوقع 4).`);
  for (const report of reports) log(`${report.id} ${report.title} — html ${new TextEncoder().encode(report.html).byteLength}B, css ${new TextEncoder().encode(report.css).byteLength}B, sha256 ${report.hash}`);
  if (!apply) return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL غير مضبوط — التشغيل الافتراضي بروفة؛ استخدم قاعدة محلية مع --apply.");
  if (!allowRemote && !localDatabase(databaseUrl)) throw new Error("--apply مسموح محليًا فقط؛ استخدم --allow-remote صراحةً للتشغيل البعيد.");

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const now = new Date().toISOString();
  let inserted = 0;
  let skipped = 0;
  try {
    await client.query("begin");
    for (const report of reports) {
      const result = await client.query(`insert into jak_code_reports
        (id, slug, title, excerpt, image, html, css, show_on_homepage, status, author_id, version, created_at, updated_at, published_at, source_url, source_post_id, source_published_at, source_modified_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, null, 1, $10, $10, $11, $12, $13, $14, $15)
        on conflict do nothing returning id`, [randomUUID(), report.slug, report.title, report.excerpt, report.image, report.html, report.css, report.showOnHomepage ? 1 : 0, publish ? "published" : "draft", now, publish ? (report.sourcePublishedAt || now) : null, report.sourceUrl, report.id, report.sourcePublishedAt, report.sourceModifiedAt]);
      if (!result.rowCount) { skipped += 1; continue; }
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
  log(`تم إدراج ${inserted} ${publish ? "تقارير منشورة" : "مسودات"} وتجاوز ${skipped} موجودة مسبقًا في معاملة واحدة.`);
}

main().catch((error) => { console.error(`[jak-import] فشل: ${error.message}`); process.exitCode = 1; });
