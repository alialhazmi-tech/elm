/**
 * توقيت الرياض في المحرر — وحدة نقية بلا اعتماديات تستوردها الواجهة والخادم سواء.
 * المملكة بلا توقيت صيفي، فالإزاحة ثابتة +03:00 ويُبنى ISO من وقت الحائط مباشرة.
 */

const RIYADH_OFFSET = "+03:00";
const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** يحوّل قيمة datetime-local (بلا منطقة) إلى ISO بافتراض أن المدخل بتوقيت الرياض؛ null للمدخل غير الصالح. */
export function riyadhWallTimeToIso(value: string): string | null {
  const match = WALL_TIME.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] ?? "00"}${RIYADH_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** بداية اليوم الحالي بتوقيت الرياض كـ ISO (UTC) — لعدّ «اليوم» كما يراه المحرر لا كما يراه الخادم. */
export function riyadhDayStartIso(now: number | Date = Date.now()): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  return new Date(`${day}T00:00:00${RIYADH_OFFSET}`).toISOString();
}

const timeFormatter = () =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Riyadh" });

const dateTimeFormatter = () =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Riyadh",
  });

/** «14:05» بتوقيت الرياض — للشرائح القصيرة كشارة العاجل. */
export function formatRiyadhTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : timeFormatter().format(date);
}

/** «الثلاثاء 9 سبتمبر 14:05» بتوقيت الرياض — يطابق صيغة صفحة الجدولة. */
export function formatRiyadhDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateTimeFormatter().format(date);
}
