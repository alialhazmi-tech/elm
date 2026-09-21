/**
 * تطبيع النص العربي لمطابقة القواميس، وأدوات العدّ.
 * المطابقة تجري على نص مُطبَّع، بينما قواعد التنسيق تعمل على النص الخام.
 */

// النطاقات بترميز \u صراحةً: بعض هذه المحارف خفي ولا يظهر في المحرر.
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const DIRECTIONAL = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;
const ARABIC_INDIC = /[\u0660-\u0669\u06F0-\u06F9]/g;

/** يزيل التشكيل والتطويل والمحارف الخفية ويوحّد الهمزات والألفات. */
export function normalizeArabic(input: string): string {
  return input
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(DIRECTIONAL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** يحوّل الأرقام العربية والفارسية إلى أرقام لاتينية. */
export function toLatinDigits(input: string): string {
  return input.replace(ARABIC_INDIC, (digit) => {
    const code = digit.codePointAt(0) ?? 0;
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

export function hasArabicIndicDigits(input: string): boolean {
  ARABIC_INDIC.lastIndex = 0;
  return ARABIC_INDIC.test(input);
}

/** عدّ الكلمات: أي وحدة تحوي حرفًا أو رقمًا. */
export function countWords(input: string): number {
  if (!input) return 0;
  return input
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

export interface PhraseMatch {
  phrase: string;
  index: number;
  excerpt: string;
}

const EXCERPT_PADDING = 24;

function excerptAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - EXCERPT_PADDING);
  const end = Math.min(text.length, index + length + EXCERPT_PADDING);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

const LETTER = /\p{L}/u;
/** سوابق ملتصقة تسبق الكلمة العربية ولا تكسر كونها بداية كلمة. */
const CLITICS = ["وال", "فال", "بال", "كال", "ال", "لل", "و", "ف", "ب", "ل", "ك"];

/**
 * هل تبدأ المطابقة عند بداية كلمة فعلية؟
 *
 * ضرورية لا تجميلية: المطبّع يحوّل «ة» إلى «ه»، فتصير «العربية» → «العربيه»
 * وبداخلها «بيه» — وهي صفة محظورة. بلا هذا الفحص تُحجب كل مادة تذكر
 * «المملكة العربية السعودية» أو «الأجنبية» أو «الطبية».
 */
function atWordStart(text: string, index: number): boolean {
  if (index === 0) return true;
  const before = text[index - 1];
  if (!LETTER.test(before)) return true;

  // السوابق الملتصقة مقبولة إن كانت هي نفسها بداية الكلمة: «وسعاده» تُطابق «سعاده».
  for (const clitic of CLITICS) {
    const start = index - clitic.length;
    if (start >= 0 && text.slice(start, index) === clitic) {
      if (start === 0 || !LETTER.test(text[start - 1])) return true;
    }
  }
  return false;
}

/**
 * يبحث عن عبارات محظورة داخل النص بعد تطبيع الطرفين.
 * يعيد مواضع المطابقة داخل النص المُطبَّع مع مقتطف قابل للعرض.
 */
export function findPhrases(text: string, phrases: readonly string[]): PhraseMatch[] {
  if (!text) return [];
  const haystack = normalizeArabic(text);
  // البحث بلا حساسية لحالة الأحرف اللاتينية (MBS / mbs)؛ لا أثر له على العربية.
  const searchable = haystack.toLowerCase();
  const matches: PhraseMatch[] = [];

  for (const phrase of phrases) {
    const needle = normalizeArabic(phrase).toLowerCase();
    if (!needle) continue;

    let from = 0;
    for (;;) {
      const index = searchable.indexOf(needle, from);
      if (index === -1) break;
      if (atWordStart(searchable, index)) {
        matches.push({
          phrase,
          index,
          excerpt: excerptAround(haystack, index, needle.length),
        });
      }
      from = index + needle.length;
    }
  }

  return matches.sort((a, b) => a.index - b.index);
}

/**
 * مطابقة غير متداخلة تفضّل العبارة الأطول.
 * تمنع مطابقة «دكتور» داخل «الدكتور» و«كيلومتر» داخل «كيلومترات»، وهو ما يفسد الإصلاح الآلي.
 */
export function findPhrasesNonOverlapping(
  text: string,
  phrases: readonly string[],
): PhraseMatch[] {
  const ordered = [...phrases].sort(
    (a, b) => normalizeArabic(b).length - normalizeArabic(a).length,
  );
  const claimed: Array<[number, number]> = [];
  const matches: PhraseMatch[] = [];

  for (const phrase of ordered) {
    const length = normalizeArabic(phrase).length;

    for (const match of findPhrases(text, [phrase])) {
      const start = match.index;
      const end = start + length;
      if (claimed.some(([claimedStart, claimedEnd]) => start < claimedEnd && end > claimedStart)) {
        continue;
      }
      claimed.push([start, end]);
      matches.push(match);
    }
  }

  return matches.sort((a, b) => a.index - b.index);
}

/** يطابق تعبيرًا نمطيًا على النص المُطبَّع ويعيد المقتطفات. */
export function findPattern(text: string, pattern: RegExp): PhraseMatch[] {
  if (!text) return [];
  const haystack = normalizeArabic(text);
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const scoped = new RegExp(pattern.source, flags);
  const matches: PhraseMatch[] = [];

  for (const match of haystack.matchAll(scoped)) {
    const index = match.index ?? 0;
    matches.push({
      phrase: match[0],
      index,
      excerpt: excerptAround(haystack, index, match[0].length),
    });
  }

  return matches;
}

/** يستخرج نطاق المصدر من رابط، ويزيل بادئة www. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
