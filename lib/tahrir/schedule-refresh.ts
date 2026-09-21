/** قرار توقيت تحديث صفحة الجدولة — دالة نقية تُختبر بلا متصفح. */

/** أثناء الهدوء: مرة كل دقيقة على الأكثر ما دامت الصفحة ظاهرة. */
export const REFRESH_IDLE_MS = 60_000;
/** نافذة الترقب قبل الموعد. */
export const REFRESH_WINDOW_MS = 120_000;
/** داخل النافذة وبعد مرور الموعد حتى يختفي من المجدول. */
export const REFRESH_NEAR_MS = 15_000;
const MIN_DELAY_MS = 1_000;

/**
 * المهلة حتى التحديث التالي:
 * - لا موعد أو موعد غير مقروء → دقيقة.
 * - الموعد أبعد من دقيقتين → دقيقة.
 * - داخل الدقيقتين → 15 ثانية، مع تحديث واحد بعد ثانية من مرور الموعد مباشرة.
 * - الموعد مضى ولم يختفِ بعد → 15 ثانية حتى يرقّيه المجدول.
 */
export function nextRefreshDelay(nextScheduledAt: string | null | undefined, now: number = Date.now()): number {
  const at = nextScheduledAt ? Date.parse(nextScheduledAt) : Number.NaN;
  if (!Number.isFinite(at)) return REFRESH_IDLE_MS;
  const remaining = at - now;
  if (remaining > REFRESH_WINDOW_MS) return REFRESH_IDLE_MS;
  if (remaining <= 0) return REFRESH_NEAR_MS;
  return Math.max(MIN_DELAY_MS, Math.min(REFRESH_NEAR_MS, remaining + MIN_DELAY_MS));
}
