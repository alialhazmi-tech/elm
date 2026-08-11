#!/usr/bin/env node
/**
 * زرع/تحديث مستخدم للوحة «تحرير العلم»:
 *   node --env-file=.env.local scripts/tahrir-user.mjs <username> <password> "<الاسم>" [editor|approver|chief]
 */

import { neon } from "@neondatabase/serverless";

import { hashPassword } from "../lib/tahrir/crypto.ts";

const [username, password, displayName, role = "editor"] = process.argv.slice(2);

if (!username || !password || !displayName) {
  console.error('الاستخدام: node scripts/tahrir-user.mjs <username> <password> "<الاسم>" [الدور]');
  process.exit(2);
}
if (!["editor", "approver", "chief"].includes(role)) {
  console.error("الدور يجب أن يكون: editor أو approver أو chief");
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
  insert into users (id, username, display_name, role, password_hash, created_at)
  values (${crypto.randomUUID()}, ${username}, ${displayName}, ${role}, ${passwordHash}, ${now})
  on conflict (username) do update
  set display_name = ${displayName}, role = ${role}, password_hash = ${passwordHash}
`;

console.log(`تم — المستخدم «${displayName}» (${username}) بدور ${role}.`);
