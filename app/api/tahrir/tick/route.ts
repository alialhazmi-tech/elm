import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { revalidatePublicStory } from "@/lib/tahrir/revalidatePublic";
import { runRetentionCleanup } from "@/lib/tahrir/retention";
import { promoteDueScheduled } from "@/lib/tahrir/service";

let nextCleanupAt = 0;

/** مقارنة بزمن ثابت: طول مختلف يُرفض بعد المرور على المتوقَّع كاملًا، لا عند أول محرف مختلف. */
function safeEqual(actual: string, expected: string): boolean {
  let diff = actual.length ^ expected.length;
  for (let i = 0; i < expected.length; i += 1) diff |= (actual.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** عامل داخلي أو خارجي يستدعي POST بمفتاح خاص؛ فتح اللوحة لا ينشر محتوى. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Scheduler not configured" }, { status: 503 });
  if (!safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const promoted = await promoteDueScheduled();
    promoted.forEach(revalidatePublicStory);
    // التنظيف مرة في الساعة، وليس مع كل نبضة نشر.
    if (Date.now() >= nextCleanupAt) {
      nextCleanupAt = Date.now() + 3600_000;
      const db = getDb();
      await db?.execute(sql`delete from request_limits where expires_at < ${new Date(Date.now() - 86400_000).toISOString()}`)
        .catch(() => console.error("[scheduler] cleanup failed"));
      // الاحتفاظ بالبيانات: دفعات صغيرة قابلة لإعادة التشغيل؛ فشلها لا يوقف النشر.
      if (db) {
        await runRetentionCleanup(db)
          .then((report) => console.log(JSON.stringify({ event: "scheduler:retention", ...report })))
          .catch(() => console.error("[scheduler] retention failed"));
      }
    }
    return Response.json({ ok: true, promoted: promoted.length }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[scheduler] tick failed");
    return Response.json({ ok: false }, { status: 503 });
  }
}
