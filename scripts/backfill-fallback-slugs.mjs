#!/usr/bin/env node
/**
 * تصحيح المواد المنشورة التي حُفظت بسلاج بديل `story-xxxxxxxx` قبل إصلاح اشتقاق السلاج من العنوان (2026-09-13).
 *
 * يشتق السلاج بالدالة نفسها التي يستعملها المحرر (`stableIdentity`) فلا يختلف الناتج عن مادة منشورة اليوم.
 * الرابط القديم لا ينكسر: حارس canonical في صفحة المادة يحوّل أي سلاج مخالف 308 إلى الرابط المحفوظ.
 * يُحدَّث السلاج فقط (مع مسودات التعديل التابعة للمادة) ويُسجَّل في audit_log؛ لا يمس الإصدار أو الحالة أو المتن.
 *
 * التشغيل:
 *   node --env-file-if-exists=.env.local scripts/backfill-fallback-slugs.mjs            # عرض فقط
 *   node --env-file-if-exists=.env.local scripts/backfill-fallback-slugs.mjs --apply    # تنفيذ وكتابة ملف تراجع
 *   node --env-file-if-exists=.env.local scripts/backfill-fallback-slugs.mjs --rollback=migration-audit/slug-backfill-*.json
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { neon } from "@neondatabase/serverless";
import { stableIdentity } from "../lib/tahrir/write-policy.ts";

const FALLBACK = /^story-[0-9a-f]{8}$/;
const ACTOR = "system:slug-backfill";
const args = new Map(process.argv.slice(2).map(arg => { const [key, value = "true"] = arg.replace(/^--/, "").split("="); return [key, value]; }));
const apply = args.get("apply") === "true";
const rollbackFile = args.get("rollback");

if (!process.env.DATABASE_URL) { console.error("DATABASE_URL غير مضبوط."); process.exit(1); }
const sql = neon(process.env.DATABASE_URL);

async function applyChanges(changes, action) {
  // لكل مادة: السلاج يُبدَّل فقط إذا ما زال بقيمته المتوقعة (حارس ضد تعديل متزامن)، ثم مسودات التعديل التابعة، ثم سجل التدقيق.
  const statements = changes.flatMap(change => [
    sql`update stories set slug=${change.to}, updated_at=${new Date().toISOString()} where id=${change.id} and slug=${change.from}`,
    sql`update stories set slug=${change.to} where revision_of=${change.id} and slug=${change.from}`,
    sql`insert into audit_log(id,at,actor,action,story_id,detail,context)
        values(${crypto.randomUUID()},${new Date().toISOString()},${ACTOR},${action},${change.id},
               ${`تصحيح رابط المادة: ${change.from} → ${change.to}`},
               ${JSON.stringify({ v: 1, actorId: null, actorName: ACTOR, changes: [{ field: "slug", before: change.from, after: change.to }] })}::jsonb)`,
  ]);
  await sql.transaction(statements);
}

if (rollbackFile) {
  const saved = JSON.parse(await readFile(rollbackFile, "utf8"));
  const changes = saved.changes.map(change => ({ id: change.id, from: change.to, to: change.from }));
  await applyChanges(changes, "slug:rollback");
  console.log(`أُعيد ${changes.length} سلاجًا إلى قيمته السابقة.`);
  process.exit(0);
}

const rows = await sql`select id, section, slug, title from stories
  where status='published' and revision_of is null and slug ~ '^story-[0-9a-f]{8}$' order by published_at`;
const changes = [];
for (const row of rows) {
  const { slug } = stableIdentity(null, { title: row.title, section: row.section, slug: "" }, row.id);
  if (FALLBACK.test(slug) || slug === row.slug) { console.log(`تخطٍّ (عنوان فارغ): ${row.id}`); continue; }
  changes.push({ id: row.id, section: row.section, from: row.slug, to: slug, title: row.title });
}
for (const change of changes) console.log(`${change.section}/${change.id.slice(0, 8)}  ${change.from}  →  ${change.to}`);
console.log(`\n${changes.length} مادة منشورة من ${rows.length} ستُصحَّح.`);
if (!apply) { console.log("عرض فقط — أضف --apply للتنفيذ."); process.exit(0); }
if (!changes.length) process.exit(0);

const out = path.join("migration-audit", `slug-backfill-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ at: new Date().toISOString(), changes }, null, 2));
await applyChanges(changes, "slug:backfill");
const [{ n }] = await sql`select count(*)::int as n from stories where status='published' and revision_of is null and slug ~ '^story-[0-9a-f]{8}$'`;
console.log(`نُفّذ. المتبقي بسلاج بديل: ${n}. ملف التراجع: ${out}`);
