/**
 * حدود «اليوم» بتوقيت الرياض للوحة التحرير.
 * الطوابع في القاعدة نصوص ISO بتوقيت UTC، واليوم التحريري يبدأ منتصف ليل الرياض (21:00Z لليوم السابق).
 * الرياض ثابتة على +03:00 بلا توقيت صيفي؛ تاريخ اليوم يُستخرج عبر Intl ثم تُبنى اللحظتان بالإزاحة الثابتة.
 */

export const RIYADH_TIME_ZONE = "Asia/Riyadh";
const RIYADH_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;

const dayParts = new Intl.DateTimeFormat("en-US", {
  timeZone: RIYADH_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export interface RiyadhDayBounds {
  /** YYYY-MM-DD بتوقيت الرياض. */
  dayKey: string;
  /** أول لحظة في اليوم (شاملة) كـISO بتوقيت UTC. */
  startIso: string;
  /** أول لحظة في اليوم التالي (غير شاملة) كـISO بتوقيت UTC. */
  endIso: string;
  startMs: number;
  endMs: number;
}

/** مفتاح اليوم YYYY-MM-DD للحظة معينة بتوقيت الرياض. */
export function riyadhDayKey(at: Date | string | number = new Date()): string {
  const date = at instanceof Date ? at : new Date(at);
  const parts = Object.fromEntries(dayParts.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function riyadhDayBounds(now: Date = new Date()): RiyadhDayBounds {
  const dayKey = riyadhDayKey(now);
  const [year, month, day] = dayKey.split("-").map(Number);
  const startMs = Date.UTC(year, month - 1, day) - RIYADH_OFFSET_MS;
  const endMs = startMs + DAY_MS;
  return { dayKey, startMs, endMs, startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() };
}

/** هل الطابع النصي يقع داخل اليوم؟ يقبل صيغة Z أو الإزاحة الصريحة لأن المقارنة على اللحظة لا النص. */
export function inRiyadhDay(iso: string | null | undefined, bounds: RiyadhDayBounds): boolean {
  if (!iso) return false;
  const at = Date.parse(iso);
  return Number.isFinite(at) && at >= bounds.startMs && at < bounds.endMs;
}

/** مفاتيح آخر N يومًا بتوقيت الرياض من الأقدم إلى اليوم. */
export function riyadhDayKeys(days: number, now: Date = new Date()): string[] {
  return Array.from({ length: days }, (_, index) => riyadhDayKey(new Date(now.getTime() - (days - 1 - index) * DAY_MS)));
}
