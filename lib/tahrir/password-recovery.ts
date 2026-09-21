import { staffPasswordError } from "./password-policy";
import { eq, sql } from "drizzle-orm";
import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { hashPassword } from "./crypto";
import { readRecoveryToken, recoveryAccountState } from "./password-recovery-token";

/** التحديث والتدقيق ذريّان، ونسخة الجلسة تمنع إعادة الاستخدام ولو وصل طلبان معًا. */
export async function redeemStaffRecovery(token: string, password: string): Promise<boolean> {
  if (staffPasswordError(password)) return false;
  const claims = readRecoveryToken(token, process.env.AUTH_SECRET ?? "");
  const db = getDb();
  if (!claims || !db) return false;
  const [user] = await db.select().from(users).where(eq(users.id, claims.userId)).limit(1);
  if (!user || user.status !== "active" || user.sessionVersion !== claims.version || recoveryAccountState(user) !== claims.state) return false;
  const passwordHash = await hashPassword(password);
  // أعد فحص الانتهاء بعد تجزئة كلمة المرور، ولا تكتب أي تغيير إذا استُهلك الرابط.
  if (claims.expires <= Date.now()) return false;
  const now = new Date().toISOString();
  const result = await db.execute<{ id: string }>(sql`
    with changed as (
      update users set password_hash = ${passwordHash}, session_version = session_version + 1,
        must_change_password = 0, updated_at = ${now}
      where id = ${user.id} and session_version = ${claims.version} and status = 'active'
        and password_hash = ${user.passwordHash} and email = ${user.email} and username = ${user.username}
      returning id, username
    ), logged as (
      insert into audit_log (id, at, actor, action, detail)
      select ${crypto.randomUUID()}, ${now}, username, 'users:recover-password', 'استعادة كلمة المرور عبر البريد' from changed
    ) select id from changed
  `);
  return result.rows.length === 1;
}
