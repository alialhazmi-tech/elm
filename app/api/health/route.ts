import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { DATABASE_READINESS_SQL } from "@/lib/db-readiness";

export async function GET() {
  try {
    const db = getDb();
    if (!db) throw new Error("unavailable");
    const readiness = await db.execute(sql.raw(DATABASE_READINESS_SQL));
    if (readiness.rows.length) throw new Error("schema not ready");
    const result = await db.execute<{ overdue: number }>(sql`select count(*)::int as overdue from stories
      where status='scheduled' and scheduled_at < ${new Date(Date.now() - 5 * 60_000).toISOString()}`);
    if (result.rows[0]?.overdue) throw new Error("overdue");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
