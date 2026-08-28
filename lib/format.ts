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

const BRIEF_SPLIT = /(?<=[.!?؟])\s+/;
const BRIEF_WORDS = 25;
const BRIEF_CHARS = 180;

/** «قبل القراءة» على صفحة المادة: جملة خلاصة، لا لصق أول المتن. */
export function formatReadingBrief(excerpt: string): string {
  const clean = formatArticleDek(excerpt);
  if (!clean) return "";

  const sentences = clean.split(BRIEF_SPLIT).map((part) => part.trim()).filter(Boolean);
  const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean);

  let brief = sentences[0] ?? clean;
  if (wordsOf(brief).length < 8 && sentences[1]) {
    brief = `${brief} ${sentences[1]}`.trim();
  }

  const words = wordsOf(brief);
  if (words.length > BRIEF_WORDS) brief = words.slice(0, BRIEF_WORDS).join(" ");
  if (brief.length > BRIEF_CHARS) {
    const cut = brief.slice(0, BRIEF_CHARS);
    const lastSpace = cut.lastIndexOf(" ");
    brief = (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim();
  }

  return brief.replace(/[.\s…]+$/u, "").trim();
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
