#!/usr/bin/env node
/**
 * هجرة «جاك العلم» من موقعه المستقل (jakelelm.alelm.net) إلى شرائح المنصة.
 *
 *   node --env-file=.env.local scripts/jak-migrate.mjs --dry-run --ids=1741,40   # فحص بلا كتابة (JSON في migration-audit/jak/)
 *   node --env-file=.env.local scripts/jak-migrate.mjs --ids=1741                # كتابة كمسودة (status=draft)
 *   node --env-file=.env.local scripts/jak-migrate.mjs --publish                 # الكل، منشورة
 *
 * المصدر جيلان: (أ) شرائح منظّمة بسمات data-slide-type (ملفان)، (ب) صفحات يدوية
 * بأصناف مختلفة لكل ملف — تُحلَّل استدلاليًا: مقاطع section → عناوين/فقرات/خلفيات.
 * الضمانات: قراءة فقط من ووردبريس؛ upsert آمن للتكرار؛ المحتوى يُنقل حرفيًا بلا صياغة؛
 * HTML المقاطع الأصلي يُحفظ في jak_sources للمراجعة.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import process from "node:process";

import { neon } from "@neondatabase/serverless";

const BASE = "https://jakelelm.alelm.net";
const ROOT = new URL("..", import.meta.url).pathname;
const OUT_DIR = path.join(ROOT, "migration-audit", "jak");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const DRY_RUN = flag("dry-run");
const PUBLISH = flag("publish");
const IDS = (value("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

if (!DRY_RUN && !process.env.DATABASE_URL) {
  console.error("DATABASE_URL غير مضبوط — شغّل عبر: node --env-file=.env.local scripts/jak-migrate.mjs");
  process.exit(1);
}
const sql = DRY_RUN ? null : neon(process.env.DATABASE_URL);

/* ============ أدوات نصية ============ */

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", hellip: "…", ndash: "–", mdash: "—" };
const decode = (t) =>
  t
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
const strip = (h) => decode(h.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
const oneLine = (h) => strip(h).replace(/\n+/g, " ").trim();
const words = (t) => t.split(/\s+/).filter(Boolean).length;
const isNumeric = (t) => /^[\s\d.,%+\-–]+(\s*(ثانية|دقيقة|ساعة|يوم|عام|سنة|مليون|مليار|ألف|دولار|ريال|٪|%))?$/u.test(t.trim()) || /^\d+\s*من\s*كل\s*\d+$/u.test(t.trim());
const clip = (t, max) => (t.length <= max ? t : `${t.slice(0, max + 1).replace(/\s+\S*$/u, "").replace(/[،؛:.\s]+$/u, "")}…`);

/* ============ الجلب ============ */

async function getJson(url) {
  const r = await fetch(url, { headers: { "User-Agent": "alelm-jak-migration/1.0 (read-only)" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}
async function getHtml(url) {
  const r = await fetch(url, { headers: { "User-Agent": "alelm-jak-migration/1.0 (read-only)" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}

/* ============ التحليل ============ */

/** خرائط الخلفيات من CSS الصفحة: class → url — للصفحات اليدوية التي تضع الصور في الستايل. */
function cssBackgrounds(html) {
  const map = new Map();
  for (const [, css] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const url = body.match(/url\(["']?(https?:[^"')]+\.(?:webp|jpe?g|png|avif))["']?\)/i)?.[1];
      if (!url) continue;
      for (const cls of selector.matchAll(/\.([A-Za-z0-9_-]+)/g)) if (!map.has(cls[1])) map.set(cls[1], url);
    }
  }
  return map;
}

function sectionImage(tag, inner, cssMap) {
  const attr = tag.match(/data-img-desktop="([^"]+)"/)?.[1] ?? inner.match(/data-img-desktop="([^"]+)"/)?.[1];
  if (attr) return attr;
  const inline = (tag + inner).match(/background(?:-image)?:\s*url\(["']?(https?:[^"')]+)["']?\)/i)?.[1];
  if (inline) return inline;
  const img = inner.match(/<img[^>]+src="([^"]+\.(?:webp|jpe?g|png|avif))"/i)?.[1];
  if (img && !/logo|شعار/i.test(img)) return img;
  const classes = (tag.match(/class="([^"]+)"/)?.[1] ?? "").split(/\s+/).filter(Boolean);
  for (const cls of classes) if (cssMap.has(cls)) return cssMap.get(cls);
  // خلفية على صنف شقيق يشترك في رمز الصفحة: cr-page-2-part ↔ .cr-page-2-bg
  for (const cls of classes) {
    const token = cls.match(/(?:page|p|s|slide|section)-?\d+/i)?.[0];
    if (!token) continue;
    for (const [key, url] of cssMap) if (key.includes(token) && /bg|background|cover|hero|image/i.test(key)) return url;
  }
  for (const cls of inner.matchAll(/class="([^"]+)"/g)) for (const c of cls[1].split(/\s+/)) if (cssMap.has(c)) return cssMap.get(c);
  return null;
}

/** سطور الكتل النصية في مقطع: <p> و<li> و<div> الورقية — الصفحات اليدوية تضع النص في div. */
function blockLines(inner, exclude = []) {
  const marked = inner.replace(/<\/(p|li|div|h[1-6]|blockquote)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  const drop = new Set(exclude.map((t) => t.trim()));
  const out = [];
  for (const raw of strip(marked).split("\n")) {
    const line = raw.trim();
    if (!line || drop.has(line) || words(line) < 2 && !isNumeric(line)) continue;
    if (out[out.length - 1] === line) continue;
    out.push(line);
  }
  return out;
}

/** مقطع مخصص للجوال فقط (تكرار لنسخة الحاسوب) — لا يشمل hide-on-mobile وهي نسخة الحاسوب. */
const isMobileOnly = (cls) => /(show|only)[-_]?on[-_]?mobile|mobile[-_](snap|slide|only|title|subhead)|^mobile\b/i.test(cls) && !/hide[-_]on[-_]mobile/i.test(cls);

const cleanInner = (inner) => inner.replace(/<svg[\s\S]*?<\/svg>/gi, "").replace(/<canvas[\s\S]*?<\/canvas>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");

/** الجيل المنظّم: data-slide-type على كل section. */
function parseStructured(sections) {
  const slides = [];
  for (const { tag, inner, image } of sections) {
    const kind = tag.match(/data-slide-type="([^"]+)"/)?.[1];
    const panels = [...inner.matchAll(/<div class="[^"]*__sticky-panel[^"]*"[^>]*>([\s\S]*?)(?=<div class="[^"]*__sticky-panel|$)/g)].map((m) => m[1]);
    const h = (x) => oneLine(x.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/)?.[1] ?? "");
    const p = (x) => { const t = h(x); return blockLines(x.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/g, ""), [t]).join("\n"); };
    if (kind === "cover") slides.push({ type: "hero", title: h(inner), body: p(inner), image, src: inner });
    else if (kind === "end") slides.push({ type: "end", title: h(inner), body: p(inner), image, src: inner });
    else if (kind === "comparison") {
      const title = h(inner);
      const lines = p(inner).split("\n").map((l) => l.trim()).filter(Boolean);
      let sides = lines.map((l) => { const m = l.match(/^(.+?)[:：]\s*(.+)$/); return m ? { value: m[1].trim(), label: m[2].trim() } : null; }).filter(Boolean).slice(0, 2);
      if (sides.length < 2) {
        const joined = [title, ...lines].filter((x) => x && !/^مقابل$/u.test(x)).join(" ");
        const halves = joined.split(/\s+مقابل\s+/u);
        if (halves.length === 2) sides = halves.map((half) => { const m = half.trim().match(/^([\d.,%+\-–]+(?:\s*(?:ثانية|دقيقة|ساعة|يوم|عام|سنة|مليون|مليار|ألف|دولار|ريال))?)\s*(.*)$/u); return m ? { value: m[1].trim(), label: m[2].trim() } : { value: "", label: half.trim() }; });
      }
      slides.push(sides.length === 2 && sides.every((x) => x.value) ? { type: "comparison", title: isNumeric(title) ? "" : title, body: "", data: { sides }, image, src: inner } : { type: "text", title, body: lines.join("\n"), image, src: inner });
    } else if (panels.length > 1) {
      slides.push({ type: "text", title: h(panels[0]), body: p(panels[0]), image, src: panels[0] });
      for (const panel of panels.slice(1)) {
        const title = h(panel); const body = p(panel);
        if (isNumeric(title)) slides.push({ type: "stat", title: "", stat: title, statLabel: clip(body.split("\n")[0] ?? "", 140), body: body.split("\n").slice(1).join("\n"), image, src: panel });
        else slides.push({ type: "fact", title, body, image, src: panel });
      }
    } else slides.push({ type: "text", title: h(inner), body: p(inner), image, src: inner });
  }
  return slides;
}

/** الجيل اليدوي: استدلال من العناوين وكتل النص وصناديق الأحداث (تسلسل زمني). */
function parseHeuristic(sections) {
  const slides = [];
  const seen = new Set();
  let timeline = null; // يُجمَّع من مقاطع متتالية كل منها حدث واحد
  const flushTimeline = () => { if (timeline && timeline.data.points.length) slides.push(timeline); timeline = null; };
  sections.forEach(({ tag, inner, image }, index) => {
    const cls = tag.match(/class="([^"]+)"/)?.[1] ?? "";
    if (isMobileOnly(cls)) return; // نسخ الجوال تكرار لنسخ الحاسوب
    const heads = [...inner.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g)].map((m) => oneLine(m[1])).filter(Boolean);
    const events = [...inner.matchAll(/<div class="[^"]*event-box[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g)].map((m) => m[1]);
    if (events.length) {
      const points = events.map((e) => ({
        year: oneLine(e.match(/class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\//)?.[1] ?? ""),
        title: oneLine(e.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/)?.[1] ?? e.match(/class="[^"]*tl-title[^"]*"[^>]*>([\s\S]*?)<\//)?.[1] ?? ""),
        detail: oneLine(e.match(/class="[^"]*desc[^"]*"[^>]*>([\s\S]*?)(?:<\/|$)/)?.[1] ?? ""),
      })).filter((pt) => pt.year || pt.title || pt.detail);
      if (!timeline) timeline = { type: "timeline", title: heads[0] ?? "", body: "", data: { points: [] }, image, src: inner };
      for (const pt of points) if (!timeline.data.points.some((x) => x.year === pt.year && x.detail === pt.detail)) timeline.data.points.push(pt);
      return;
    }
    flushTimeline();
    const withoutHeads = inner.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/g, "");
    const lines = blockLines(withoutHeads, heads).filter((l) => !/^\d{4}$/.test(l));
    if (!heads.length && !lines.length) return;
    const text = lines.join("\n");
    const key = `${heads.join("|")}::${text.slice(0, 80)}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (index === 0 || (slides.length === 0 && heads.length)) { slides.push({ type: "hero", title: heads[0] ?? "", body: heads.slice(1).join(" — ") || clip(text, 160), image, src: inner }); return; }
    const numeric = heads.find((h) => isNumeric(h));
    if (numeric) { slides.push({ type: "stat", title: heads.filter((h) => h !== numeric)[0] ?? "", stat: numeric, statLabel: clip(lines[0] ?? "", 140), body: lines.slice(1).join("\n"), image, src: inner }); return; }
    if (/باختصار|خلاصة|الخلاصة/u.test(heads[0] ?? "")) { slides.push({ type: "summary", title: heads[0], body: text, data: { items: lines.slice(0, 6) }, image, src: inner }); return; }
    if (heads.length >= 2 && lines.length >= 2 && heads.length === lines.length) {
      heads.forEach((h, i) => slides.push({ type: "fact", title: h, body: lines[i], image, src: inner }));
      return;
    }
    slides.push({ type: "text", title: heads[0] ?? "", body: heads.slice(1).concat(lines).filter(Boolean).join("\n"), image, src: inner });
  });
  flushTimeline();
  if (slides.length > 1 && slides[slides.length - 1].type === "text" && words(slides[slides.length - 1].body) < 80) slides[slides.length - 1].type = "end";
  return slides;
}

function parsePage(html) {
  const cssMap = cssBackgrounds(html);
  const start = html.indexOf("<main");
  const scope = start > 0 ? html.slice(start) : html;
  const sections = [...scope.matchAll(/(<section\b[^>]*>)([\s\S]*?)<\/section>/g)]
    .map(([, tag, inner]) => ({ tag, inner: cleanInner(inner), image: sectionImage(tag, inner, cssMap) }))
    .filter(({ tag }) => !/footer|nav|header|comments/i.test(tag));
  const structured = sections.some(({ tag }) => /data-slide-type=/.test(tag));
  const slides = (structured ? parseStructured(sections) : parseHeuristic(sections)).map((s) => ({
    id: randomUUID(), type: s.type, title: s.title ?? "", body: s.body ?? "", stat: s.stat ?? "", statLabel: s.statLabel ?? "",
    image: s.image ?? null, imageStyle: null, imagePrompt: "", sourceContext: clip(oneLine(s.src ?? ""), 600), hidden: false, data: s.data ?? null,
  }));
  return { slides, mode: structured ? "structured" : "heuristic", sections: sections.length, source: sections.map((s) => s.tag + s.inner + "</section>").join("\n") };
}

/** الإسقاط النصي — مرآة projectSlides في lib/tahrir/jak.ts. */
function projectSlides(slides) {
  return slides.filter((s) => !s.hidden).map((s) => [
    s.title, s.stat && `${s.stat} — ${s.statLabel}`.trim(), s.body, s.data?.quoteBy, s.data?.items?.join("، "),
    s.data?.sides?.map((x) => `${x.label}: ${x.value}`).join(" مقابل "),
    s.data?.points?.map((p) => `${p.year} ${p.title} ${p.detail}`).join(". "),
  ].filter(Boolean).join("\n").trim()).filter(Boolean).join("\n\n");
}

const SECTION_BY_CAT = { 13: "technology", 14: "culture", 1: "world" };

/* ============ التنفيذ ============ */

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const posts = await getJson(`${BASE}/wp-json/wp/v2/posts?per_page=50&_fields=id,slug,link,title,excerpt,date,modified,categories,featured_media`);
  const selected = IDS.length ? posts.filter((p) => IDS.includes(String(p.id))) : posts;
  const mediaIds = [...new Set(selected.map((p) => p.featured_media).filter(Boolean))];
  const media = mediaIds.length ? await getJson(`${BASE}/wp-json/wp/v2/media?include=${mediaIds.join(",")}&per_page=50&_fields=id,source_url`) : [];
  const mediaUrl = new Map(media.map((m) => [m.id, m.source_url]));
  const report = [];

  for (const post of selected) {
    const html = await getHtml(post.link);
    const { slides, mode, sections, source } = parsePage(html);
    const title = decode(post.title.rendered).replace(/\s+/g, " ").trim();
    const storyId = `jak-${post.id}`;
    const slug = decodeURIComponent(post.slug);
    const body = projectSlides(slides);
    const intro = slides.find((s) => s.type !== "hero" && s.body)?.body ?? slides[0]?.body ?? "";
    const story = {
      id: storyId, slug, section: SECTION_BY_CAT[post.categories?.[0]] ?? "world", title,
      excerpt: clip(intro.replace(/\n+/g, " "), 220), eyebrow: "جاك العلم", readingMinutes: Math.max(2, Math.round(words(body) / 180)),
      image: mediaUrl.get(post.featured_media) ?? slides[0]?.image ?? null, publishedAt: `${post.date}+03:00`, updatedAt: `${post.modified}+03:00`,
      status: PUBLISH ? "published" : "draft", format: "jakalelm", body, authorName: "فريق العلم",
      seoDescription: clip(intro.replace(/\n+/g, " "), 160),
    };
    const summary = { id: post.id, storyId, title, mode, sections, slides: slides.length, types: slides.map((s) => s.type), images: slides.filter((s) => s.image).length, words: words(body) };
    report.push(summary);
    await writeFile(path.join(OUT_DIR, `${post.id}.json`), JSON.stringify({ story, slides }, null, 2));
    console.log(`${post.id} ${title} — ${mode} | مقاطع ${sections} → شرائح ${slides.length} [${summary.types.join(",")}] صور ${summary.images} كلمات ${summary.words}`);

    if (DRY_RUN) continue;
    const now = new Date().toISOString();
    await sql`insert into stories (id, slug, section, title, excerpt, eyebrow, reading_minutes, image, published_at, status, body, author_name, updated_at, format, seo_description)
      values (${story.id}, ${story.slug}, ${story.section}, ${story.title}, ${story.excerpt}, ${story.eyebrow}, ${story.readingMinutes}, ${story.image}, ${story.publishedAt}, ${story.status}, ${story.body}, ${story.authorName}, ${now}, ${story.format}, ${story.seoDescription})
      on conflict (id) do update set slug = excluded.slug, section = excluded.section, title = excluded.title, excerpt = excluded.excerpt, reading_minutes = excluded.reading_minutes,
        image = excluded.image, published_at = excluded.published_at, body = excluded.body, updated_at = excluded.updated_at, format = excluded.format, seo_description = excluded.seo_description`;
    await sql`delete from story_slides where story_id = ${storyId}`;
    for (const [position, s] of slides.entries()) {
      await sql`insert into story_slides (id, story_id, position, type, title, body, stat, stat_label, image, image_style, image_prompt, source_context, hidden, data)
        values (${s.id}, ${storyId}, ${position}, ${s.type}, ${s.title}, ${s.body}, ${s.stat}, ${s.statLabel}, ${s.image}, ${s.imageStyle}, ${s.imagePrompt}, ${s.sourceContext}, 0, ${s.data ? JSON.stringify(s.data) : null}::jsonb)`;
    }
    await sql`insert into jak_sources (story_id, source, updated_at) values (${storyId}, ${source.slice(0, 400000)}, ${now})
      on conflict (story_id) do update set source = excluded.source, updated_at = excluded.updated_at`;
  }
  await writeFile(path.join(OUT_DIR, "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), dryRun: DRY_RUN, items: report }, null, 2));
  console.log(`\nتم: ${report.length} ملفًا — التقرير في migration-audit/jak/report.json`);
}

main().catch((error) => { console.error(error); process.exit(1); });
