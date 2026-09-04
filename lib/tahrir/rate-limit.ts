import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

/** حجز محاولة ذري مشترك بين نسخ الخدمة. مفاتيح الحسابات/IP تُحفظ كبصمات. */
export async function consumeLimit(scope: string, identity: string, limit: number, seconds: number) {
  const db = getDb();
  if (!db) throw new Error("RATE_LIMIT_UNAVAILABLE");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${process.env.AUTH_SECRET ?? ""}:${scope}:${identity}`));
  const key = `${scope}:${Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("")}`;
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + seconds * 1000).toISOString();
  const result = await db.execute<{ count: number }>(sql`
    insert into request_limits (key, count, expires_at) values (${key}, 1, ${expires})
    on conflict (key) do update set
      count=case when request_limits.expires_at <= ${now} then 1 else request_limits.count + 1 end,
      expires_at=case when request_limits.expires_at <= ${now} then ${expires} else request_limits.expires_at end
    returning count
  `);
  return Number(result.rows[0]?.count) <= limit;
}
