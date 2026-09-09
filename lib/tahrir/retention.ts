/**
 * الاحتفاظ بالبيانات — تنظيف ساعي من نبضة المجدول.
 * كل حذف على دفعات صغيرة (CTE بحدّ) لتجنب أقفال طويلة، وقابل لإعادة التشغيل بلا أثر.
 */

import { sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db";

export const RETENTION = {
  /** سجلات الحفظ التلقائي (draft:save بوضع automatic) في audit_log. */
  autosaveAuditDays: 90,
  /** التنبيهات التحريرية المقروءة. */
  readNotificationDays: 90,
  /** أحدث النسخ المحفوظة لكل مادة في story_versions. */
  versionsPerStory: 50,
  /** تفاصيل استهلاك الذكاء في ai_usage. */
  aiUsageMonths: 13,
} as const;

export const RETENTION_BATCH = 2_000;
const MAX_BATCHES_PER_RUN = 25;

export interface RetentionReport {
  autosaveAudit: number;
  readNotifications: number;
  storyVersions: number;
  aiUsage: number;
}

type Executor = Pick<Database, "execute">;

async function drain(db: Executor, statement: (limit: number) => SQL): Promise<number> {
  let total = 0;
  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
    const result = await db.execute(statement(RETENTION_BATCH));
    const deleted = result.rows.length;
    total += deleted;
    if (deleted < RETENTION_BATCH) break;
  }
  return total;
}

export function retentionCutoffs(now: Date = new Date()) {
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const monthsAgo = (months: number) => {
    const date = new Date(now.getTime());
    date.setUTCMonth(date.getUTCMonth() - months);
    return date.toISOString();
  };
  return {
    autosaveAudit: daysAgo(RETENTION.autosaveAuditDays),
    readNotifications: daysAgo(RETENTION.readNotificationDays),
    aiUsage: monthsAgo(RETENTION.aiUsageMonths),
  };
}

export async function runRetentionCleanup(db: Executor, now: Date = new Date()): Promise<RetentionReport> {
  const cutoff = retentionCutoffs(now);
  const autosaveAudit = await drain(db, (limit) => sql`
    with doomed as (
      select id from audit_log
      where action = 'draft:save' and context->>'saveMode' = 'automatic' and at < ${cutoff.autosaveAudit}
      limit ${limit}
    )
    delete from audit_log where id in (select id from doomed) returning id`);
  const readNotifications = await drain(db, (limit) => sql`
    with doomed as (
      select id from editorial_notifications
      where read_at is not null and created_at < ${cutoff.readNotifications}
      limit ${limit}
    )
    delete from editorial_notifications where id in (select id from doomed) returning id`);
  const storyVersions = await drain(db, (limit) => sql`
    with ranked as (
      select id, row_number() over (partition by story_id order by version desc, created_at desc, id desc) as rank
      from story_versions
    ), doomed as (
      select id from ranked where rank > ${RETENTION.versionsPerStory} limit ${limit}
    )
    delete from story_versions where id in (select id from doomed) returning id`);
  const aiUsage = await drain(db, (limit) => sql`
    with doomed as (
      select id from ai_usage where at < ${cutoff.aiUsage} limit ${limit}
    )
    delete from ai_usage where id in (select id from doomed) returning id`);
  return { autosaveAudit, readNotifications, storyVersions, aiUsage };
}
