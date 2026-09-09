/**
 * مسودة الحارس الموحدة — مصدر واحد لكل مواضع الفحص الخمسة
 * (الفحص الحي، طلب الاعتماد، النشر، الجدولة، ترقية المجدول في موعده).
 * كانت المواضع تبني المسودة كلٌّ على حدة فتغيب عنها «عاجل» ومصادر المتن،
 * فلا تعمل قواعد BREAKING-* وROYAL-FOREIGN-SOURCE وRESTRICTED-ISRAEL إلا صدفة.
 *
 * `buildGuardDraft` نقية بلا اعتماديات خادمية؛ `loadGuardContext` تستورد القاعدة كسولًا
 * حتى يبقى الملف قابلًا للاستيراد المباشر في اختبارات الوحدة.
 */

import { and, eq, isNotNull, sql } from "drizzle-orm";

import { stripHtmlToText } from "../content/html.ts";
import type { Draft, GuardContext, MediaAsset } from "../policy/types.ts";
import { riyadhDayStartIso } from "./riyadh-time.ts";

export interface GuardDraftInput {
  id?: string;
  title: string;
  /** متن HTML من المحرر أو نص فقرات إرثي — يُحوَّل نصًا هنا. */
  body: string;
  format?: string | null;
  image?: string | null;
  breakingUntil?: string | null;
  /** وسائط محلولة عبر guardMediaFor (تحقق حقوق المكتبة)؛ إن غابت تُشتق من image كصورة غير موثقة. */
  media?: MediaAsset[];
  now?: number;
}

const ABSOLUTE_HREF = /<a\b[^>]*\bhref\s*=\s*(?:"(https?:\/\/[^"]+)"|'(https?:\/\/[^']+)')/gi;

/** «عاجل» ساري المفعول: تاريخ صالح في المستقبل. */
export function isBreakingActive(breakingUntil: string | null | undefined, now = Date.now()): boolean {
  if (!breakingUntil) return false;
  const until = Date.parse(breakingUntil);
  return Number.isFinite(until) && until > now;
}

/** روابط المصادر من المتن: http(s) المطلقة فقط، بلا تكرار، بترتيب ظهورها. */
export function extractSourceUrls(body: string): string[] {
  const urls = new Set<string>();
  for (const match of body.matchAll(ABSOLUTE_HREF)) {
    const url = (match[1] ?? match[2] ?? "").replace(/&amp;/g, "&").trim();
    if (url) urls.add(url);
  }
  return [...urls];
}

export function buildGuardDraft(input: GuardDraftInput): Draft {
  const media = input.media ?? (input.image ? [{ url: input.image, rightsCleared: false, flags: [] as string[] }] : undefined);
  return {
    ...(input.id ? { id: input.id } : {}),
    title: input.title,
    body: stripHtmlToText(input.body),
    surface: input.format === "jakalelm" ? "design" : undefined,
    media,
    breaking: isBreakingActive(input.breakingUntil, input.now),
    sourceUrls: extractSourceUrls(input.body),
  };
}

interface GovernanceLike {
  breakingDailyLimit?: unknown;
}

/** عدد مواد «عاجل» المنشورة منذ بداية اليوم بتوقيت الرياض — عدّ رخيص بفهرس الحالة. */
export async function countBreakingPublishedToday(now = Date.now()): Promise<number> {
  const [{ getDb }, { stories }] = await Promise.all([import("@/lib/db"), import("@/db/schema")]);
  const db = getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stories)
    .where(and(eq(stories.status, "published"), isNotNull(stories.breakingUntil), sql`${stories.publishedAt} >= ${riyadhDayStartIso(now)}`));
  return Number(row?.count ?? 0);
}

/** سياق الحارس: عدّاد العاجل اليومي وسقفه من حوكمة الذكاء إن ضُبط، ومعرّف الفاعل للتدقيق. */
export async function loadGuardContext(
  settings: { governance: GovernanceLike },
  actorId?: string,
): Promise<GuardContext> {
  const configured = settings.governance.breakingDailyLimit;
  const breakingDailyLimit = typeof configured === "number" && Number.isInteger(configured) && configured > 0 ? configured : undefined;
  const breakingCountToday = await countBreakingPublishedToday().catch(() => 0);
  return { breakingCountToday, ...(breakingDailyLimit ? { breakingDailyLimit } : {}), ...(actorId ? { actorId } : {}) };
}
