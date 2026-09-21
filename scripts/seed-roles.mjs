#!/usr/bin/env node
/**
 * زرع الأدوار النظامية الأربعة وصلاحياتها الافتراضية (بلا لمس ما زُرع سابقًا)،
 * وترحيل approver → managing_editor، وتعيين مسؤول نظام اختياريًا:
 *   node --env-file=.env.local scripts/seed-roles.mjs [--admin <username>]
 */

import { neon } from "@neondatabase/serverless";

import { LEGACY_ROLE_MAP, SYSTEM_ROLES } from "../lib/tahrir/permissions.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL غير مضبوط — أضفه في .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const adminFlag = args.indexOf("--admin");
const adminUsername = adminFlag >= 0 ? args[adminFlag + 1] : null;

const sql = neon(url);
const now = new Date().toISOString();

const existing = new Set((await sql`select id from roles`).map((row) => row.id));
for (const [position, role] of SYSTEM_ROLES.entries()) {
  if (existing.has(role.id)) {
    console.log(`موجود: ${role.label} (${role.id}) — لم يُمسّ.`);
    continue;
  }
  await sql`
    insert into roles (id, label, description, is_system, position, created_at, updated_at)
    values (${role.id}, ${role.label}, ${role.description}, 1, ${position}, ${now}, ${now})`;
  for (const key of role.defaults) {
    await sql`insert into role_permissions (role_id, permission_key) values (${role.id}, ${key}) on conflict do nothing`;
  }
  console.log(`زُرع: ${role.label} (${role.id}) — ${role.defaults.length} صلاحية.`);
}

for (const [legacy, target] of Object.entries(LEGACY_ROLE_MAP)) {
  const moved = await sql`update users set role = ${target} where role = ${legacy} returning username`;
  if (moved.length > 0) console.log(`رُحّل ${moved.length} عضو من ${legacy} إلى ${target}.`);
}

if (adminUsername) {
  const rows = await sql`update users set role = 'admin', updated_at = ${now} where username = ${adminUsername} returning display_name`;
  if (rows.length === 0) {
    console.error(`لا عضو باسم «${adminUsername}».`);
    process.exit(2);
  }
  console.log(`عُيّن «${rows[0].display_name}» مسؤول نظام.`);
}

const [{ n }] = await sql`select count(*)::int as n from users where role = 'admin' and status = 'active'`;
if (n === 0) {
  console.warn("تنبيه: لا مسؤول نظام فعّال — عيّن واحدًا: node --env-file=.env.local scripts/seed-roles.mjs --admin <username>");
}
console.log("تم.");
