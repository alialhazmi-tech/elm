import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { revalidatePublicStory } from "@/lib/tahrir/revalidatePublic";
import { promoteDueScheduled } from "@/lib/tahrir/service";

/** عامل خارجي يستدعي POST بمفتاح خاص؛ فتح اللوحة لا ينشر محتوى. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Scheduler not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const promoted = await promoteDueScheduled();
    promoted.forEach(revalidatePublicStory);
    await getDb()?.execute(sql`delete from request_limits where expires_at < ${new Date(Date.now() - 86400_000).toISOString()}`);
    return Response.json({ ok: true, promoted: promoted.length }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[scheduler] tick failed");
    return Response.json({ ok: false }, { status: 503 });
  }
}
