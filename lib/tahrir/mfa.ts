import { and, eq, lt, sql } from "drizzle-orm";
import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { matchingCounter, openMfa, recoveryHash } from "./totp";

/** استهلاك الرمز ذري: لا تنجح إعادة استخدامه حتى من عاملين متزامنين. */
export async function verifyMfa(user: typeof users.$inferSelect, code: string) {
  const db = getDb();
  if (!db || !user.mfaSecret) return false;
  const hash = await recoveryHash(user.id, code);
  if (/^[a-f\d]{32}$/i.test(code.trim())) {
    const result = await db.execute(sql`update users set mfa_recovery_hashes=mfa_recovery_hashes - ${hash}
      where id=${user.id} and session_version=${user.sessionVersion} and mfa_secret=${user.mfaSecret} and mfa_recovery_hashes ? ${hash} returning id`);
    return result.rows.length === 1;
  }
  const secret = await openMfa(user.mfaSecret, `secret:${user.id}`);
  const counter = await matchingCounter(secret, code);
  if (counter === null) return false;
  const updated = await db.update(users).set({ mfaLastCounter: counter }).where(and(eq(users.id, user.id), eq(users.sessionVersion, user.sessionVersion), eq(users.mfaSecret, user.mfaSecret), lt(users.mfaLastCounter, counter))).returning({ id: users.id });
  return updated.length === 1;
}
