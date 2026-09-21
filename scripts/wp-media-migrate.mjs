#!/usr/bin/env node
/**
 * M-3 (مُقدَّمة بقرار المالك): هجرة الصور البارزة من ووردبريس إلى بوكت المنصة.
 *
 *   node --env-file=.env.local scripts/wp-media-migrate.mjs --limit=300   # دفعة تجريبية
 *   node --env-file=.env.local scripts/wp-media-migrate.mjs               # كل المتبقي
 *   node --env-file=.env.local scripts/wp-media-migrate.mjs --verify-only # عدّ فقط
 *
 * النطاق: الصور البارزة فقط (stories.image الخارجية) — المتون القديمة نصية بلا صور
 * داخلية بتصميم مقصود، فالمشمول ≈ صورة واحدة لكل مادة لا 97 ألف ملف وسائط.
 *
 * الضمانات:
 * - الاستئناف طبيعي بلا نقطة توقف: بعد النجاح يصير الرابط /uploads/… فلا يُلتقط ثانية.
 * - تنزيل ثم رفع ثم تحقق HEAD بالحجم، ثم تحديث المادة وصف media في معاملة واحدة —
 *   أي فشل يُبقي الرابط القديم يعمل كما هو (remotePatterns يخدمه) ويُسجل في التقرير.
 * - الصيغ خارج png/jpeg/webp (gif/svg…) تُتخطى بروابطها القديمة — مسار /uploads
 *   لا يخدم غيرها، وتُحصى في التقرير لقرار لاحق.
 * - لا حذف ولا كتابة في ووردبريس إطلاقًا.
 */

import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import process from "node:process";

import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";

const ROOT = new URL("..", import.meta.url).pathname;
const LOG_PATH = path.join(ROOT, "migration-audit", "wp-media-migrate.log");
const REPORT_PATH = path.join(ROOT, "docs", "metrics", "wp-media-migrate-report.json");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const LIMIT = Number(value("limit") ?? Infinity);
const CONCURRENCY = Math.max(1, Math.min(12, Number(value("concurrency") ?? 6)));
const DRY_RUN = flag("dry-run");
const VERIFY_ONLY = flag("verify-only");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL غير مضبوط — شغّل عبر: node --env-file=.env.local scripts/wp-media-migrate.mjs");
  process.exit(1);
}
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

let s3Client = null;
function storageClient() {
  const config = storageConfig();
  s3Client ??= new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return { s3: s3Client, bucket: config.bucket };
}

function sniffImage(bytes) {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) return { mime: "image/png", ext: "png" };
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return { mime: "image/jpeg", ext: "jpg" };
  if (
    bytes.length > 16 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return { mime: "image/webp", ext: "webp" };
  return null;
}

async function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  await appendFile(LOG_PATH, `${stamped}\n`).catch(() => {});
}

async function fetchImage(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "alelm-media-migration/1.0 (read-only)" },
      });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function pendingCount() {
  const [row] = await sql`select count(*)::int as n from stories where image like 'http%'`;
  return row.n;
}

async function migratedCount() {
  const [row] = await sql`select count(*)::int as n from stories where image like '/uploads/%'`;
  return row.n;
}

async function main() {
  await mkdir(path.dirname(LOG_PATH), { recursive: true });

  const [pending, migrated] = await Promise.all([pendingCount(), migratedCount()]);
  await log(`الوضع الحالي: ${migrated} صورة في البوكت — ${pending} صورة خارجية متبقية`);
  if (VERIFY_ONLY) return;

  // فشل مبكر واضح: لا معنى لتنزيل مئات الصور إن كانت بيانات المخزن ناقصة أصلًا.
  if (!DRY_RUN) {
    try {
      storageConfig();
    } catch (error) {
      await log(String(error instanceof Error ? error.message : error));
      await log("أضف مفاتيح البوكت إلى .env.local — تجدها في Railway: خدمة البوكت ← Variables:");
      await log("AWS_ENDPOINT_URL · AWS_S3_BUCKET_NAME · AWS_ACCESS_KEY_ID · AWS_SECRET_ACCESS_KEY · AWS_DEFAULT_REGION=auto");
      process.exit(1);
    }
  }

  const target = Math.min(pending, LIMIT);
  await log(`بدء هجرة الوسائط${DRY_RUN ? " (تجربة بلا كتابة)" : ""} — هدف هذه التشغيلة: ${target} صورة بتوازي ${CONCURRENCY}`);

  const stats = { done: 0, bytes: 0, skippedFormat: 0, failed: 0 };
  const issues = [];
  // ترقيم بالمفتاح: ما نجح يخرج من الشرط وحده، وما فشل أو تُخطي يبقى خلف lastId
  // فلا يُعاد التقاطه في هذه التشغيلة — وإعادة التشغيل تعيد محاولته من الصفر.
  let lastId = "";

  while (stats.done + stats.skippedFormat + stats.failed < target) {
    const batch = await sql`
      select id, image from stories
      where image like 'http%' and id > ${lastId}
      order by id asc
      limit ${Math.min(CONCURRENCY * 10, target - stats.done - stats.skippedFormat - stats.failed)}`;
    if (batch.length === 0) break;
    lastId = batch[batch.length - 1].id;

    // معالجة متوازية بمقدار CONCURRENCY.
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const slice = batch.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map(async (row) => {
          try {
            const bytes = await fetchImage(row.image);
            const kind = sniffImage(bytes);
            if (!kind) return { row, skip: "صيغة غير مدعومة (ليست png/jpeg/webp)" };
            if (DRY_RUN) return { row, ok: true, bytes: bytes.byteLength, kind, dry: true };

            const uuid = randomUUID();
            const filename = `${uuid}.${kind.ext}`;
            const key = `uploads/${filename}`;
            const { s3, bucket } = storageClient();
            await s3.send(new PutObjectCommand({
              Bucket: bucket, Key: key, Body: bytes, ContentType: kind.mime,
              CacheControl: "public, max-age=31536000, immutable",
            }));
            const stored = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
            if (stored.ContentLength !== bytes.byteLength) {
              throw new Error("فشل تحقق اكتمال الرفع (الحجم لا يطابق)");
            }
            // تحديث المادة وسجل المكتبة معًا — الحقوق موثقة إرثيًا كما في بروفة M-1.
            await sql.transaction([
              sql`update stories set image = ${`/uploads/${filename}`} where id = ${row.id}`,
              sql`insert into media (id, url, filename, mime, bytes, width, height, rights_cleared, flags, uploaded_by, created_at, ai_generated)
                  values (${uuid}, ${`/uploads/${filename}`}, ${`wp-${row.id}.${kind.ext}`}, ${kind.mime}, ${bytes.byteLength},
                          ${null}, ${null}, ${1}, ${"legacy"}, ${"wp-media-migrate"}, ${new Date().toISOString()}, ${0})
                  on conflict (id) do nothing`,
            ]);
            return { row, ok: true, bytes: bytes.byteLength, kind };
          } catch (error) {
            return { row, error: String(error).slice(0, 140) };
          }
        }),
      );
      for (const result of results) {
        if (result.ok) { stats.done += 1; stats.bytes += result.bytes; }
        else if (result.skip) { stats.skippedFormat += 1; if (issues.length < 200) issues.push({ id: result.row.id, image: result.row.image, reason: result.skip }); }
        else { stats.failed += 1; if (issues.length < 200) issues.push({ id: result.row.id, image: result.row.image, reason: result.error }); }
      }
    }

    const gb = (stats.bytes / 1024 / 1024 / 1024).toFixed(2);
    await log(`تقدم: نُقلت ${stats.done} (${gb}GB) — تُخطيت ${stats.skippedFormat} — فشلت ${stats.failed}`);
  }

  const [pendingAfter, migratedAfter] = await Promise.all([pendingCount(), migratedCount()]);
  await log("——— الخلاصة ———");
  await log(`نُقل في هذه التشغيلة: ${stats.done} صورة (${(stats.bytes / 1024 / 1024).toFixed(0)}MB) — تخطٍّ: ${stats.skippedFormat} — فشل: ${stats.failed}`);
  await log(`الإجمالي الآن: ${migratedAfter} في البوكت — ${pendingAfter} خارجية متبقية`);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: DRY_RUN ? "dry-run" : "migrate",
    movedThisRun: stats.done,
    movedBytes: stats.bytes,
    skippedUnsupportedFormat: stats.skippedFormat,
    failed: stats.failed,
    inBucketTotal: migratedAfter,
    externalRemaining: pendingAfter,
    issues,
  };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await log("التقرير: docs/metrics/wp-media-migrate-report.json");
}

main().catch(async (error) => {
  await log(`فشل قاتل: ${String(error)}`);
  process.exit(1);
});
