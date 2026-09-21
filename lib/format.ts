/** تنسيق العرض الموحد: جميع الأرقام لاتينية، مع بقاء أسماء الأشهر عربية. */

const ARABIC_INDIC = /[\u0660-\u0669\u06F0-\u06F9]/g;

/** يحوّل أي أرقام عربية أو فارسية إلى الأرقام اللاتينية 0–9. */
export function toLatinDigits(input: string | number): string {
  return String(input)
    .replace(ARABIC_INDIC, (digit) => {
      const code = digit.codePointAt(0) ?? 0;
      const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
      return String(code - base);
    })
    .replace(/٪/g, "%");
}

// timeZone صريح: الخادم يعمل بـUTC فبعد منتصف الليل بتوقيت الرياض يعرض تاريخ الأمس بدونه.
const HIJRI = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Riyadh",
});

const GREGORIAN = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Riyadh",
});

const ARTICLE_TIMESTAMP = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Riyadh",
});

/** تاريخ ووقت المادة بالميلادي والأرقام اللاتينية، بتوقيت الرياض. */
export function formatArticleTimestamp(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : ARTICLE_TIMESTAMP.format(date);
}

/** تاريخ اليوم بتوقيت الرياض بصيغة YYYY-MM-DD — لسمات dateTime الآلية. */
export function riyadhDateISO(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(date);
}

/** «هجري ثم ميلادي» بأسماء أشهر عربية وأرقام لاتينية. */
export function brandDate(iso: string): { hijri: string; gregorian: string } {
  const date = new Date(iso);
  return {
    hijri: toLatinDigits(HIJRI.format(date)),
    gregorian: toLatinDigits(GREGORIAN.format(date)),
  };
}

/** موجز المادة للعرض: يُنظَّف من فراغات ونقاط ووردبريس الزائدة، بلا قصّ اصطناعي. */
export function formatArticleDek(excerpt: string): string {
  return excerpt.replace(/\s+/g, " ").replace(/[.\s…]+$/u, "").trim();
}

/** عدد + معدود بقواعد العربية: مفرد، مثنى، 3–10 جمع، 11+ مفرد منصوب. */
function arabicCount(
  n: number,
  forms: { one: string; two: string; few: string; many: string },
): string {
  if (n <= 1) return forms.one;
  if (n === 2) return forms.two;
  if (n <= 10) return `${toLatinDigits(n)} ${forms.few}`;
  return `${toLatinDigits(n)} ${forms.many}`;
}

/** زمن القراءة بصيغة سليمة: «دقيقة واحدة»، «دقيقتان»، «5 دقائق»، «11 دقيقة». */
export function formatReadingMinutes(minutes: number): string {
  return arabicCount(Math.max(1, Math.round(minutes)), {
    one: "دقيقة واحدة",
    two: "دقيقتان",
    few: "دقائق",
    many: "دقيقة",
  });
}

/** زمن نسبي سليم الجمع: «منذ ساعة»، «منذ ساعتين»، «منذ 5 ساعات»، «منذ 3 أيام». */
export function relativeTimeAr(iso?: string): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 1) return "قبل قليل";
  if (hours < 24) {
    return `منذ ${arabicCount(hours, { one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة" })}`;
  }
  const days = Math.round(hours / 24);
  return `منذ ${arabicCount(days, { one: "يوم", two: "يومين", few: "أيام", many: "يومًا" })}`;
}

/* ——— توقيت الرياض للوحة التحرير: صيغة واحدة بدل ثماني نسخ من Intl.DateTimeFormat في المكوّنات ——— */

export type RiyadhDateStyle = "short" | "medium" | "long";

const RIYADH_DATE_PARTS: Record<RiyadhDateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
};

const riyadhFormatters = new Map<string, Intl.DateTimeFormat>();

function riyadhFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let formatter = riyadhFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { ...options, timeZone: "Asia/Riyadh" });
    riyadhFormatters.set(key, formatter);
  }
  return formatter;
}

function parseIso(iso: string | number | Date | null | undefined): Date | null {
  if (iso === null || iso === undefined || iso === "") return null;
  const date = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** تاريخ بتوقيت الرياض: «9 سبتمبر 2026» (medium افتراضيًا)؛ قيمة غائبة أو تالفة تعيد "". */
export function formatRiyadhDate(iso: string | number | Date | null | undefined, style: RiyadhDateStyle = "medium"): string {
  const date = parseIso(iso);
  return date ? toLatinDigits(riyadhFormatter(RIYADH_DATE_PARTS[style]).format(date)) : "";
}

/** وقت بتوقيت الرياض على 24 ساعة: «14:05» أو «14:05:09» مع الثواني. */
export function formatRiyadhTime(iso: string | number | Date | null | undefined, { seconds = false } = {}): string {
  const date = parseIso(iso);
  if (!date) return "";
  return toLatinDigits(
    riyadhFormatter({ hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}), hour12: false }).format(date),
  );
}

/** تاريخ ووقت معًا بتوقيت الرياض: «9 سبتمبر 2026، 14:05». */
export function formatRiyadhDateTime(
  iso: string | number | Date | null | undefined,
  { style = "medium", seconds = false }: { style?: RiyadhDateStyle; seconds?: boolean } = {},
): string {
  const date = parseIso(iso);
  if (!date) return "";
  return toLatinDigits(
    riyadhFormatter({
      ...RIYADH_DATE_PARTS[style],
      hour: "2-digit",
      minute: "2-digit",
      ...(seconds ? { second: "2-digit" } : {}),
      hour12: false,
    }).format(date),
  );
}
