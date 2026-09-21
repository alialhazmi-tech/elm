#!/usr/bin/env node
/**
 * استيراد أعضاء الإدارة من ملف Excel (بلا كلمات مرور فيه) — كل حساب يُنشأ بكلمة مرور عشوائية
 * مؤقتة وعلم الإجبار على تغييرها، وبالحالة المختارة (معلّق افتراضيًا حتى التفعيل من اللوحة):
 *   node --env-file=.env.local scripts/import-members.mjs <file.xlsx> [--activate] [--dry-run]
 * يطبع لكل عضو كلمته المؤقتة مرة واحدة — انسخها من الطرفية ولا تُخزَّن في أي مكان آخر.
 */

import { generateStaffTemporaryPassword as tempPassword } from "../lib/tahrir/password-policy.ts";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { neon } from "@neondatabase/serverless";

import { hashPassword } from "../lib/tahrir/crypto.ts";
import { SYSTEM_ROLES } from "../lib/tahrir/permissions.ts";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const activate = args.includes("--activate");
const dryRun = args.includes("--dry-run");
if (!file) {
  console.error("الاستخدام: node --env-file=.env.local scripts/import-members.mjs <file.xlsx> [--activate] [--dry-run]");
  process.exit(2);
}
if (!process.env.DATABASE_URL && !dryRun) {
  console.error("DATABASE_URL غير مضبوط — أضفه في .env.local");
  process.exit(1);
}

/** تسميات الأدوار في الملف → معرّفاتها. */
const ROLE_BY_LABEL = new Map(SYSTEM_ROLES.map((role) => [role.label, role.id]));
ROLE_BY_LABEL.set("مدير تحرير", "managing_editor");
ROLE_BY_LABEL.set("رئيس تحرير", "chief");

const decode = (text) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** قراءة الورقة الأولى من xlsx بلا اعتماديات: unzip + XML بسيط. */
function readSheet(path) {
  const dir = mkdtempSync(join(tmpdir(), "alelm-xlsx-"));
  try {
    execFileSync("unzip", ["-o", "-q", path, "-d", dir]);
    const sharedXml = readFileSync(join(dir, "xl/sharedStrings.xml"), "utf8");
    const shared = [...sharedXml.matchAll(/<si>(.*?)<\/si>/gs)].map((m) =>
      decode([...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join("")),
    );
    const sheetXml = readFileSync(join(dir, "xl/worksheets/sheet1.xml"), "utf8");
    return [...sheetXml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)].map((row) => {
      const cells = {};
      for (const cell of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<v>(.*?)<\/v>|<is>(.*?)<\/is>)?<\/c>/gs)) {
        let value = cell[3] ?? "";
        if (cell[2].includes('t="s"')) value = shared[Number(value)] ?? "";
        if (cell[4]) value = decode([...cell[4].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join(""));
        cells[cell[1]] = value.trim();
      }
      return cells;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const rows = readSheet(file);
const headerIndex = rows.findIndex((row) => /User Name|اسم المستخدم/.test(row.B ?? ""));
if (headerIndex < 0) {
  console.error("لم أجد صف الترويسة (اسم المستخدم / User Name).");
  process.exit(2);
}

const members = [];
const problems = [];
for (const row of rows.slice(headerIndex + 1)) {
  const username = row.B ?? "";
  if (!username) continue;
  const email = (row.E ?? "").toLowerCase();
  const nick = row.F ?? "";
  const first = row.C ?? "";
  const last = row.D ?? "";
  const displayName = nick && !nick.includes("@") ? nick : [first, last].filter(Boolean).join(" ") || username.split("@")[0];
  const roleLabel = row.G ?? "";
  const role = ROLE_BY_LABEL.get(roleLabel);
  if (!role) {
    problems.push(`${username}: دور غير معروف «${roleLabel}» — تُرك خارج الاستيراد`);
    continue;
  }
  if (nick.includes("@")) problems.push(`${username}: اللقب يحوي البريد بدل اسم — استُعمل «${displayName}»`);
  if (email && username.toLowerCase() !== email) problems.push(`${username}: البريد ${email} لا يطابق اسم المستخدم`);
  members.push({ username, email, displayName, role });
}
const seen = new Map();
for (const member of members) {
  const key = member.displayName;
  if (seen.has(key)) problems.push(`«${key}» مكرر: ${seen.get(key)} و${member.username}`);
  else seen.set(key, member.username);
}

console.log(`${members.length} عضوًا في الملف.`);
for (const problem of problems) console.warn(`تنبيه — ${problem}`);



if (dryRun) {
  for (const member of members) console.log(`  ${member.role.padEnd(16)} ${member.displayName} <${member.username}>`);
  console.log("تجربة فقط — لم يُكتب شيء.");
  process.exit(0);
}

const sql = neon(process.env.DATABASE_URL);
const now = new Date().toISOString();
const status = activate ? "active" : "suspended";
let created = 0;
let skipped = 0;
const credentials = [];
for (const member of members) {
  const [existing] = await sql`select id from users where username = ${member.username}`;
  if (existing) {
    skipped += 1;
    console.log(`موجود مسبقًا: ${member.username} — لم يُمسّ.`);
    continue;
  }
  const password = tempPassword();
  await sql`
    insert into users (id, username, display_name, email, role, password_hash, status, suspend_reason, must_change_password, created_at, updated_at)
    values (${crypto.randomUUID()}, ${member.username}, ${member.displayName}, ${member.email}, ${member.role},
            ${await hashPassword(password)}, ${status}, ${activate ? "" : "بانتظار التفعيل بعد الاستيراد"}, 1, ${now}, ${now})`;
  await sql`
    insert into audit_log (id, at, actor, action, story_id, detail)
    values (${crypto.randomUUID()}, ${now}, 'import-members', 'users:create', null, ${`${member.displayName} (${member.username}) — ${member.role} · ${status}`})`;
  created += 1;
  credentials.push({ ...member, password });
}

console.log(`\nأُنشئ ${created} · تُخطّي ${skipped} · الحالة: ${activate ? "فعّال" : "معلّق حتى التفعيل من شاشة الأعضاء"}`);
if (credentials.length > 0) {
  console.log("\nكلمات المرور المؤقتة (تظهر مرة واحدة — يُجبر العضو على تغييرها عند أول دخول):");
  for (const c of credentials) console.log(`  ${c.username.padEnd(30)} ${c.password}   ${c.displayName}`);
}
