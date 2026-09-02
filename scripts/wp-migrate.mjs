#!/usr/bin/env node
/**
 * M-2: الهجرة الكاملة — سحب كل أرشيف ووردبريس المنشور (قراءة فقط) إلى قاعدتنا.
 *
 *   node --env-file=.env.local scripts/wp-migrate.mjs                  # الكل، يستأنف من نقطة التوقف
 *   node --env-file=.env.local scripts/wp-migrate.mjs --limit=2000     # دفعة تجريبية
 *   node --env-file=.env.local scripts/wp-migrate.mjs --reset          # تجاهل نقطة التوقف وابدأ من الصفر
 *   node --env-file=.env.local scripts/wp-migrate.mjs --since=2026-08-20T00:00:00 # مزامنة تزايدية بالمعدَّل بعد تاريخ
 *   node --env-file=.env.local scripts/wp-migrate.mjs --verify-only    # مطابقة الأعداد دون سحب
 *   node --env-file=.env.local scripts/wp-migrate.mjs --ids=264148,999  # سحب معرفات بأعيانها
 *   node --env-file=.env.local scripts/wp-migrate.mjs --posttype=59 --reset  # تعبئة مواد شكل واحد (59 = الفيديو) بروابطها
 *     (لمواد نُشرت بتاريخ تعديل قديم فتفلت من modified_after — يرصدها التدقيق كمفقودة)
 *
 * الضمانات (نفس عقد بروفة M-1):
 * - لا كتابة على ووردبريس إطلاقًا — قراءة REST العامة فقط.
 * - المعرّف والرابط /{section}/{id}/{slug} يُحفظان حرفيًا (الأرشيف مقدس).
 * - upsert آمن للتكرار: إعادة التشغيل لا تكرر ولا تفسد؛ الحالة التحريرية المحلية لا تُمس.
 * - ترتيب ثابت (orderby=id asc) + نقطة توقف لكل صفحة → الانقطاع يكلف صفحة واحدة كحد أقصى.
 * - الصور تبقى بروابط ووردبريس (dash.alelm.net) — نقلها إلى المخزن مرحلة M-3 مستقلة.
 *
 * المخرجات: migration-audit/wp-migrate.log (سجل حي) +
 *           migration-audit/wp-migrate.checkpoint.json (الاستئناف) +
 *           docs/metrics/wp-migrate-report.json (التقرير النهائي).
 */

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { findVideoUrlInText, normalizeVideoUrl } from "../lib/content/video.ts";

import { neon } from "@neondatabase/serverless";

const BASE = "https://dash.alelm.net/wp-json/wp/v2";
const ROOT = new URL("..", import.meta.url).pathname;
const CHECKPOINT_PATH = path.join(ROOT, "migration-audit", "wp-migrate.checkpoint.json");
const LOG_PATH = path.join(ROOT, "migration-audit", "wp-migrate.log");
const REPORT_PATH = path.join(ROOT, "docs", "metrics", "wp-migrate-report.json");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const LIMIT = Number(value("limit") ?? Infinity);
const IDS = (value("ids") ?? "").split(",").map((part) => part.trim()).filter(Boolean);
const SINCE = value("since") ?? null;
const POSTTYPE = value("posttype") ?? null;
const RESET = flag("reset");
const DRY_RUN = flag("dry-run");
const VERIFY_ONLY = flag("verify-only");
const PER_PAGE = 100;

if (!process.env.DATABASE_URL && !DRY_RUN) {
  console.error("DATABASE_URL غير مضبوط — شغّل عبر: node --env-file=.env.local scripts/wp-migrate.mjs");
  process.exit(1);
}
const sql = DRY_RUN ? null : neon(process.env.DATABASE_URL);

/* ============ سجل حي ============ */

const startedAt = new Date();
async function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  await appendFile(LOG_PATH, `${stamped}\n`).catch(() => {});
}

/* ============ جلب بإعادة محاولة ============ */

const RETRIES = 5;

async function fetchWithRetry(url, { expectJson = true } = {}) {
  let lastError;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "alelm-migration/2.0 (read-only)" },
      });
      clearTimeout(timer);
      if (response.status === 400) {
        // ما بعد آخر صفحة في REST — ليست حالة إعادة محاولة.
        return { outOfRange: true, response };
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} على ${url}`);
      return { data: expectJson ? await response.json() : await response.text(), response };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      const wait = Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500;
      await log(`  محاولة ${attempt + 1}/${RETRIES} فشلت (${String(error).slice(0, 90)}) — انتظار ${Math.round(wait / 1000)}ث`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}

async function fetchAllTerms(pathName) {
  const terms = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, outOfRange } = await fetchWithRetry(
      `${BASE}/${pathName}?per_page=100&page=${page}&_fields=id,slug,name`,
    );
    if (outOfRange) break;
    terms.push(...data);
    if (data.length < 100) break;
  }
  return terms;
}

/* ============ التحويل — مطابق حرفيًا لبروفة M-1 (scripts/wp-rehearsal.mjs) ============ */

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

/** HTML ووردبريس → نص نظيف بفقرات يفصلها سطران (المتون القديمة تبقى فقرات — عرف ملزم). */
function htmlToParagraphs(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<figure[\s\S]*?<\/figure>/gi, "")
      .replace(/\[[a-z_/][^\]]*\]/gi, "")
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

/* ============ نقطة التوقف ============ */

async function readCheckpoint() {
  // التشغيلات المرشَّحة (بتاريخ أو بشكل) لا تقرأ نقطة توقف الأرشيف الكامل ولا تكتبها.
  if (RESET || SINCE || POSTTYPE) return null;
  try {
    return JSON.parse(await readFile(CHECKPOINT_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function writeCheckpoint(state) {
  await writeFile(CHECKPOINT_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

const ALELM_API = "https://dash.alelm.net/wp-json/alelm-api/v1";

/** رابط يوتيوب المخزَّن في الموقع القديم — يُعاد قياسيًا بلا قائمة تشغيل، أو null. */
async function fetchVideoUrl(postId) {
  try {
    const { data } = await fetchWithRetry(`${ALELM_API}/single-post?id=${postId}`);
    const raw = data?.data?.video_url ?? data?.data?.video_embed_url ?? null;
    return normalizeVideoUrl(raw);
  } catch (error) {
    await log(`  تعذر جلب رابط فيديو ${postId}: ${String(error).slice(0, 80)}`);
    return null;
  }
}

/* ============ العدّ والتحقق ============ */

async function wordpressTotal() {
  const url = SINCE
    ? `${BASE}/posts?per_page=1&_fields=id&modified_after=${encodeURIComponent(SINCE)}${POSTTYPE ? `&posttype=${POSTTYPE}` : ""}`
    : `${BASE}/posts?per_page=1&_fields=id${POSTTYPE ? `&posttype=${POSTTYPE}` : ""}`;
  const { response } = await fetchWithRetry(url);
  return Number(response.headers.get("x-wp-total") ?? 0);
}

async function databaseCounts() {
  if (!sql) return { migrated: 0, published: 0 };
  const [migrated] = await sql`select count(*)::int as n from stories where id ~ '^[0-9]+$'`;
  const [published] = await sql`select count(*)::int as n from stories where id ~ '^[0-9]+$' and status = 'published'`;
  return { migrated: migrated.n, published: published.n };
}

async function verify(reportExtra = {}) {
  const [wpTotal, db] = await Promise.all([wordpressTotal(), databaseCounts()]);
  const coverage = wpTotal > 0 ? Math.round((db.published / wpTotal) * 10000) / 100 : 0;
  await log("——— التحقق ———");
  await log(`ووردبريس (منشور${SINCE ? "، معدَّل بعد " + SINCE : ""}): ${wpTotal}`);
  await log(`قاعدتنا (معرّفات رقمية): ${db.migrated} — منها منشور: ${db.published}`);
  await log(`التغطية: ${coverage}%`);
  const report = {
    generatedAt: new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    mode: SINCE ? `incremental-since-${SINCE}` : VERIFY_ONLY ? "verify-only" : "full",
    wordpressPublished: wpTotal,
    targetNumericIds: db.migrated,
    targetPublished: db.published,
    coveragePercent: coverage,
    ...reportExtra,
  };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await log(`التقرير: docs/metrics/wp-migrate-report.json`);
  return report;
}

/* ============ السحب ============ */

async function main() {
  await mkdir(path.dirname(CHECKPOINT_PATH), { recursive: true });

  if (VERIFY_ONLY) {
    await verify();
    return;
  }

  await log(
    `بدء الهجرة${SINCE ? ` التزايدية (معدَّل بعد ${SINCE})` : ""}${Number.isFinite(LIMIT) ? ` — حد ${LIMIT}` : " — الأرشيف كامل"}${DRY_RUN ? " — تجربة بلا كتابة" : ""}`,
  );

  const checkpoint = IDS.length ? null : await readCheckpoint();
  let offset = checkpoint?.offset ?? 0;
  let imported = checkpoint?.imported ?? 0;
  const failures = checkpoint?.failures ?? [];
  if (checkpoint) await log(`استئناف من الإزاحة ${offset} (مستورد سابقًا في هذا المسار: ${imported})`);

  const wpTotal = IDS.length ? IDS.length : await wordpressTotal();
  const target = IDS.length ? IDS.length : Math.min(wpTotal, Number.isFinite(LIMIT) ? offset + LIMIT : wpTotal);
  await log(`إجمالي المنشور في المصدر: ${wpTotal} — هدف هذه التشغيلة: حتى ${target}`);

  await log("سحب قواميس الوسوم والأشكال والمؤلفين…");
  const [tags, posttypes] = await Promise.all([fetchAllTerms("tags"), fetchAllTerms("posttype")]);
  const seriesByTagId = new Map(
    tags.filter((t) => SERIES_BY_TAG[t.name]).map((t) => [t.id, SERIES_BY_TAG[t.name]]),
  );
  const formatByTypeId = new Map(posttypes.map((t) => [t.id, FORMAT_BY_POSTTYPE[t.slug] ?? "news"]));
  let authorsById = new Map();
  try {
    const users = await fetchAllTerms("users");
    authorsById = new Map(users.map((u) => [u.id, u.name]));
  } catch {
    await log("(أسماء المؤلفين غير متاحة عبر REST — تُترك فارغة)");
  }
  await log(`وسوم سلاسل: ${seriesByTagId.size} — أشكال: ${formatByTypeId.size} — مؤلفون: ${authorsById.size}`);

  const stats = {
    imported: 0, urlIdentical: 0, urlNeedsRedirect: 0,
    withSeries: 0, withImage: 0, withAuthor: 0,
    sections: {}, formats: {}, series: {},
  };

  const FIELDS = "id,slug,link,title,content,excerpt,date_gmt,modified_gmt,categories,tags,posttype,featured_media,author";
  const order = SINCE ? "orderby=modified&order=asc" : "orderby=id&order=asc";
  const sinceParam = (SINCE ? `&modified_after=${encodeURIComponent(SINCE)}` : "") + (POSTTYPE ? `&posttype=${POSTTYPE}` : "");

  while (offset < target) {
    const pageUrl = IDS.length
      ? `${BASE}/posts?per_page=${PER_PAGE}&include=${IDS.join(",")}&_fields=${FIELDS}`
      : `${BASE}/posts?per_page=${PER_PAGE}&offset=${offset}&${order}${sinceParam}&_fields=${FIELDS}`;
    const { data: posts, outOfRange } = await fetchWithRetry(pageUrl);
    if (outOfRange || !posts || posts.length === 0) break;

    // الصور البارزة لهذه الصفحة في طلب واحد.
    const mediaIds = [...new Set(posts.map((p) => p.featured_media).filter(Boolean))];
    const mediaById = new Map();
    if (mediaIds.length > 0) {
      try {
        const { data: media } = await fetchWithRetry(
          `${BASE}/media?include=${mediaIds.join(",")}&per_page=100&_fields=id,source_url`,
        );
        for (const m of media ?? []) mediaById.set(m.id, m.source_url);
      } catch (error) {
        await log(`  تعذر جلب صور الصفحة عند ${offset}: ${String(error).slice(0, 90)}`);
      }
    }

    const queries = [];
    for (const post of posts) {
      try {
        const link = new URL(post.link);
        const segments = link.pathname.split("/").filter(Boolean);
        let section = segments[0] ?? "varieties";
        let needsRedirect = false;
        if (!VALID_SECTIONS.has(section)) {
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
        // رابط يوتيوب لا يظهر في REST القياسي؛ واجهة الموقع القديم الخاصة تعيده لكل مادة على حدة.
        // حقل الفيديو أولًا، ثم رابط يوتيوب داخل المتن (مواد قديمة حُفظ رابطها في النص).
        const videoUrl = format === "videos"
          ? (await fetchVideoUrl(post.id)) ?? findVideoUrlInText(post.content?.rendered ?? "")
          : null;
        if (format === "videos") stats.videos = (stats.videos ?? 0) + 1;
        if (videoUrl) stats.videosWithUrl = (stats.videosWithUrl ?? 0) + 1;

        const ourPath = `/${section}/${id}/${encodeURIComponent(slug)}`;
        const wpPath = link.pathname.replace(/\/$/, "");
        if (!needsRedirect && ourPath.toLowerCase() === wpPath.toLowerCase()) stats.urlIdentical += 1;
        else stats.urlNeedsRedirect += 1;

        if (!DRY_RUN) {
          queries.push(sql`
            insert into stories (id, slug, section, title, excerpt, eyebrow, reading_minutes,
                                 series_slug, image, published_at, status, body, author_name,
                                 updated_at, format, video_url)
            values (${id}, ${slug}, ${section}, ${cleanTitle(post.title?.rendered ?? "")},
                    ${cleanExcerpt(post.excerpt?.rendered ?? "")}, ${""},
                    ${Math.min(15, Math.max(1, Math.round(words / 200)))},
                    ${seriesSlug}, ${image}, ${post.date_gmt ? post.date_gmt + "Z" : null},
                    ${"published"}, ${body}, ${authorName},
                    ${post.modified_gmt ? post.modified_gmt + "Z" : null}, ${format}, ${videoUrl})
            on conflict (id) do update set
              slug = excluded.slug, section = excluded.section, title = excluded.title,
              excerpt = excluded.excerpt, series_slug = excluded.series_slug,
              image = excluded.image, published_at = excluded.published_at,
              body = excluded.body, author_name = excluded.author_name,
              updated_at = excluded.updated_at, format = excluded.format,
              video_url = coalesce(excluded.video_url, stories.video_url)`);
        }

        stats.imported += 1;
        if (seriesSlug) { stats.withSeries += 1; stats.series[seriesSlug] = (stats.series[seriesSlug] ?? 0) + 1; }
        if (image) stats.withImage += 1;
        if (authorName) stats.withAuthor += 1;
        stats.sections[section] = (stats.sections[section] ?? 0) + 1;
        stats.formats[format] = (stats.formats[format] ?? 0) + 1;
      } catch (error) {
        failures.push({ id: post.id, error: String(error).slice(0, 140) });
      }
    }

    // دفعة صفحة كاملة في معاملة واحدة — طلب HTTP واحد إلى Neon، وإعادة محاولة عند الفشل.
    if (queries.length > 0) {
      let done = false;
      for (let attempt = 0; attempt < 3 && !done; attempt += 1) {
        try {
          await sql.transaction(queries);
          done = true;
        } catch (error) {
          if (attempt === 2) {
            failures.push({ page: offset, error: `دفعة القاعدة: ${String(error).slice(0, 140)}` });
            stats.imported -= queries.length;
          } else {
            await log(`  فشل إدخال الدفعة عند ${offset} (محاولة ${attempt + 1}/3): ${String(error).slice(0, 90)}`);
            await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
          }
        }
      }
    }

    offset += posts.length;
    imported = (checkpoint?.imported ?? 0) + stats.imported;
    if (!SINCE && !IDS.length && !POSTTYPE) {
      await writeCheckpoint({
        offset,
        imported,
        failures: failures.slice(-200),
        wordpressTotal: wpTotal,
        updatedAt: new Date().toISOString(),
      });
    }
    const lastId = posts[posts.length - 1]?.id;
    await log(
      `صفحة ${Math.ceil(offset / PER_PAGE)}/${Math.ceil(target / PER_PAGE)} — الإزاحة ${offset}/${target} — مستورد ${stats.imported} — فشل ${failures.length} — آخر ID ${lastId}`,
    );
    if (IDS.length || posts.length < PER_PAGE) break;
  }

  await log("——— خلاصة التشغيلة ———");
  await log(`المستوردة في هذه التشغيلة: ${stats.imported} — روابط مطابقة: ${stats.urlIdentical} — تحتاج 301: ${stats.urlNeedsRedirect}`);
  await log(`بسلسلة: ${stats.withSeries} · بصورة: ${stats.withImage} · بمؤلف: ${stats.withAuthor} · إخفاقات: ${failures.length}`);
  await log(`الأقسام: ${JSON.stringify(stats.sections)}`);
  await log(`الأشكال: ${JSON.stringify(stats.formats)}`);
  if (stats.videos) await log(`فيديو: ${stats.videos} — منها برابط يوتيوب: ${stats.videosWithUrl ?? 0}`);
  if (failures.length > 0) {
    await log(`أول الإخفاقات: ${JSON.stringify(failures.slice(0, 5))}`);
  }

  if (!DRY_RUN) await verify({ runStats: stats, failures: failures.slice(0, 100) });
}

main().catch(async (error) => {
  await log(`فشل قاتل: ${String(error)}`);
  process.exit(1);
});
