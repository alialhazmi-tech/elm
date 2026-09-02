#!/usr/bin/env node
/**
 * زرع/تحديث مستخدم للوحة «تحرير العلم»:
 *   node --env-file=.env.local scripts/tahrir-user.mjs <username> <password> "<الاسم>" [admin|chief|managing_editor|editor] [email]
 * الحساب المزروع من الطرفية فعّال بكلمة مرور نهائية (لا مؤقتة) — للمسؤول الأول ولحالات الطوارئ.
 */

import { neon } from "@neondatabase/serverless";

import { hashPassword } from "../lib/tahrir/crypto.ts";
import { SYSTEM_ROLES } from "../lib/tahrir/permissions.ts";

const [username, password, displayName, role = "editor", email = ""] = process.argv.slice(2);
const ROLE_IDS = SYSTEM_ROLES.map((r) => r.id);

if (!username || !password || !displayName) {
  console.error('الاستخدام: node scripts/tahrir-user.mjs <username> <password> "<الاسم>" [الدور] [البريد]');
  process.exit(2);
}
if (!ROLE_IDS.includes(role)) {
  console.error(`الدور يجب أن يكون أحد: ${ROLE_IDS.join(" | ")}`);
  process.exit(2);
}
if (password.length < 10) {
  console.error("كلمة المرور 10 محارف على الأقل.");
  process.exit(2);
}

const sql = neon(process.env.DATABASE_URL);
const passwordHash = await hashPassword(password);
const now = new Date().toISOString();

await sql`
  insert into users (id, username, display_name, email, role, password_hash, status, must_change_password, created_at, updated_at)
  values (${crypto.randomUUID()}, ${username}, ${displayName}, ${email}, ${role}, ${passwordHash}, 'active', 0, ${now}, ${now})
  on conflict (username) do update
  set display_name = ${displayName}, role = ${role}, password_hash = ${passwordHash}, email = ${email}, updated_at = ${now}
`;

console.log(`تم — المستخدم «${displayName}» (${username}) بدور ${role}.`);
