import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    if (!db) throw new Error("unavailable");
    const result = await db.execute<{ overdue: number }>(sql`select count(*)::int as overdue from stories
      where status='scheduled' and scheduled_at < ${new Date(Date.now() - 5 * 60_000).toISOString()}`);
    if (result.rows[0]?.overdue) throw new Error("overdue");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
