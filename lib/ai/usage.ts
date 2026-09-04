/** استهلاك الذكاء وفرض السقوف — الخادم يوقف التجاوز، لا الواجهة. */

import { and, eq, gte, sql } from "drizzle-orm";

import { aiUsage } from "@/db/schema";
import { getDb } from "@/lib/db";

/** تقديرات تشغيلية محافظة للمليون توكن بالسنت؛ ليست فاتورة المزود. */
const PRICES_CENTS: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 500, output: 2500 },
  "claude-sonnet-5": { input: 300, output: 1500 },
  "claude-haiku-4-5": { input: 100, output: 500 },
};

export function costCents(model: string, inputTokens: number, outputTokens: number): number {
  const name = model.replace(/^anthropic\//, "").replace("claude-haiku-4.5", "claude-haiku-4-5");
  const price = PRICES_CENTS[name] ?? PRICES_CENTS["claude-opus-5"];
  return Math.ceil(
    (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output,
  );
}

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

  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [today] = await db
    .select({ cents: sql<number>`coalesce(sum(${aiUsage.costCents}), 0)`, calls: sql<number>`count(*)` })
    .from(aiUsage)
    .where(gte(aiUsage.at, dayStart.toISOString()));
  const [month] = await db
    .select({ cents: sql<number>`coalesce(sum(${aiUsage.costCents}), 0)` })
    .from(aiUsage)
    .where(gte(aiUsage.at, monthStart.toISOString()));

  return {
    todayCents: Number(today?.cents ?? 0),
    monthCents: Number(month?.cents ?? 0),
    todayCalls: Number(today?.calls ?? 0),
  };
}

/** يحجز تقديرًا محافظًا قبل الاستدعاء. تبقى الطلبات الفاشلة محجوزة إلى حين مراجعة الاستهلاك. */
export async function budgetGate(caps: { dailyUsd: number; monthlyUsd: number }, reservedCents = 500): Promise<{ ok: boolean; reason?: string; reservationId?: string }> {
  const db = getDb();
  if (!db) return { ok: false, reason: "تعذر التحقق من ميزانية الذكاء." };
  const reservationId = crypto.randomUUID();
  const result = await db.execute<{ allowed: boolean }>(sql`select alelm_reserve_ai(${reservationId}, ${reservedCents}, ${Math.floor(caps.dailyUsd * 100)}, ${Math.floor(caps.monthlyUsd * 100)}) as allowed`);
  if (!result.rows[0]?.allowed) return { ok: false, reason: "الرصيد المتاح لا يغطي حجز هذا الطلب؛ انتظر انتهاء الطلبات الحالية أو راجع السقف." };
  return { ok: true, reservationId };
}
