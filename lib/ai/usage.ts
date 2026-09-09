/** استهلاك الذكاء وفرض السقوف — الخادم يوقف التجاوز، لا الواجهة. */

import { and, eq, gte, sql } from "drizzle-orm";

import { aiUsage } from "@/db/schema";
import { getDb } from "@/lib/db";

export { costCents } from "./pricing";

export async function logUsage(entry: {
  reservationId?: string;
  tool: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  actor: string;
}): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("AI_USAGE_UNAVAILABLE");
  const { reservationId, ...usage } = entry;
  if (reservationId) {
    // تسوية واحدة فقط؛ يبقى الحجز المحافظ عند فشل الاستدعاء أو فقدان قياسه.
    const updated = await db.update(aiUsage).set(usage).where(and(eq(aiUsage.id, reservationId), eq(aiUsage.tool, "reservation_pending"))).returning({ id: aiUsage.id });
    if (!updated.length) throw new Error("AI_RESERVATION_ALREADY_SETTLED");
    return;
  }
  await db.insert(aiUsage).values({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...usage,
  });
}

export interface UsageTotals {
  todayCents: number;
  monthCents: number;
  todayCalls: number;
}

export async function usageTotals(): Promise<UsageTotals> {
  const db = getDb();
  if (!db) return { todayCents: 0, monthCents: 0, todayCalls: 0 };

  // نفس حدود UTC المستخدمة في دالة الحجز alelm_reserve_ai.
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  // مسح واحد لصفوف الشهر (بفهرس at)، واليوم مرشّح تجميعي داخله.
  const [row] = await db
    .select({
      todayCents: sql<number>`coalesce(sum(${aiUsage.costCents}) filter (where ${aiUsage.at} >= ${dayStart}), 0)`,
      todayCalls: sql<number>`count(*) filter (where ${aiUsage.at} >= ${dayStart})`,
      monthCents: sql<number>`coalesce(sum(${aiUsage.costCents}), 0)`,
    })
    .from(aiUsage)
    .where(gte(aiUsage.at, monthStart));

  return {
    todayCents: Number(row?.todayCents ?? 0),
    monthCents: Number(row?.monthCents ?? 0),
    todayCalls: Number(row?.todayCalls ?? 0),
  };
}

/** يحجز تقديرًا محافظًا قبل الاستدعاء. تبقى الطلبات الفاشلة محجوزة إلى حين مراجعة الاستهلاك. */
export async function budgetGate(caps: { dailyUsd: number; monthlyUsd: number }, reservedCents = 500): Promise<{ ok: boolean; reason?: string; reservationId?: string }> {
  const db = getDb();
  if (!db) return { ok: false, reason: "تعذر التحقق من ميزانية الذكاء." };
  const reservationId = crypto.randomUUID();
  const result = await db.execute<{ allowed: boolean }>(sql`select alelm_reserve_ai(${reservationId}, ${reservedCents}, ${Math.floor(caps.dailyUsd * 100)}, ${Math.floor(caps.monthlyUsd * 100)}) as allowed`);
  if (!result.rows[0]?.allowed) {
    // نفس حدود UTC المستخدمة في دالة الحجز. الأرقام لقطة تفسيرية، وليست فاتورة المزود.
    const snapshot = await db.execute<{ today: number; month: number; pending: number }>(sql`
      select coalesce(sum(cost_cents) filter (where at >= to_char(now() at time zone 'UTC', 'YYYY-MM-DD')), 0) as today,
        coalesce(sum(cost_cents), 0) as month,
        coalesce(sum(cost_cents) filter (where tool = 'reservation_pending' or tool like '%:unmeasured'), 0) as pending
      from ai_usage where at >= to_char(now() at time zone 'UTC', 'YYYY-MM')
    `);
    const totals = snapshot.rows[0];
    const daily = Math.max(0, Math.floor(caps.dailyUsd * 100) - Number(totals?.today ?? 0));
    const monthly = Math.max(0, Math.floor(caps.monthlyUsd * 100) - Number(totals?.month ?? 0));
    const pending = Number(totals?.pending ?? 0);
    const dollars = (cents: number) => `${(cents / 100).toFixed(2)} دولار`;
    return { ok: false, reason: `سقف الإنفاق الداخلي لا يسمح بهذا الطلب. الحجز المطلوب ${dollars(reservedCents)}؛ المتاح اليوم ${dollars(daily)} من سقف ${dollars(Math.floor(caps.dailyUsd * 100))}، والمتاح هذا الشهر ${dollars(monthly)}.${pending > 0 ? ` توجد حجوزات غير مسوّاة بقيمة ${dollars(pending)} هذا الشهر؛ قد تشمل طلبات سابقة تعذّر قياس استهلاكها، وتحتاج مراجعة مسؤول النظام.` : " راجع سقف الإنفاق مع مسؤول النظام."} هذا لا يعني نفاد رصيد مزوّد الذكاء.` };
  }
  return { ok: true, reservationId };
}
