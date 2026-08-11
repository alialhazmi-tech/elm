/** استهلاك الذكاء وفرض السقوف — الخادم يوقف التجاوز، لا الواجهة. */

import { gte, sql } from "drizzle-orm";

import { aiUsage } from "@/db/schema";
import { getDb } from "@/lib/db";

/** أسعار المليون توكن بالسنت (مرجع Anthropic الرسمي 2026). */
const PRICES_CENTS: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 500, output: 2500 },
  "claude-haiku-4-5": { input: 100, output: 500 },
};

export function costCents(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES_CENTS[model] ?? PRICES_CENTS["claude-opus-5"];
  return Math.ceil(
    (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output,
  );
}

export async function logUsage(entry: {
  tool: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  actor: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.insert(aiUsage).values({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...entry,
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

/** بوابة السقوف — تُستدعى قبل كل استدعاء نموذج. */
export async function budgetGate(caps: {
  dailyUsd: number;
  monthlyUsd: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const totals = await usageTotals();
  if (totals.todayCents >= caps.dailyUsd * 100) {
    return { ok: false, reason: `بلغ استهلاك اليوم سقفه ($${caps.dailyUsd}) — يرتفع غدًا أو برفع السقف من الإعدادات.` };
  }
  if (totals.monthCents >= caps.monthlyUsd * 100) {
    return { ok: false, reason: `بلغ استهلاك الشهر سقفه ($${caps.monthlyUsd}).` };
  }
  return { ok: true };
}
