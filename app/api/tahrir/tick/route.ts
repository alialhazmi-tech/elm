import { NextResponse } from "next/server";

import { promoteDueScheduled } from "@/lib/tahrir/service";

/**
 * نبضة الجدولة: ترقية المواد المجدولة التي حان موعدها.
 * تُستدعى من تحميل اللوحة، ويمكن ضربها من مراقب خارجي (uptime/cron)
 * كل دقائق — لا تكشف بيانات ولا تحتاج جلسة، وفعلها idempotent.
 */
export async function GET() {
  const promoted = await promoteDueScheduled().catch(() => 0);
  return NextResponse.json({ ok: true, promoted });
}
