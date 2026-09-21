/**
 * الرقم المفتاحي في العنوان — بطاقات صفحة السلسلة تُبرزه تحت العنوان
 * (622%، 190K، 271.5cm…) امتدادًا لآلية «بالأرقام» في الرئيسية.
 *
 * محافظ عمدًا: لا يُرجع شيئًا ما لم يكن الرقم صريحًا في العنوان،
 * فبطاقة بلا رقم أصدق من رقم مستنتج.
 */

// نسبي بامتداد صريح لا بالاسم المستعار: الاختبارات تحمّل الوحدة مباشرة في Node.
import { toLatinDigits } from "../format.ts";

/** وحدات القياس التي تُختصر لاتينيًا كما في التصميم. */
const SCALES: Array<{ words: string[]; symbol: string }> = [
  { words: ["ألف", "آلاف"], symbol: "K" },
  { words: ["مليون", "ملايين"], symbol: "M" },
  { words: ["مليار", "مليارات"], symbol: "B" },
];

const UNITS: Array<{ words: string[]; symbol: string }> = [
  { words: ["سنتيمتر", "سنتمتر", "سم"], symbol: "cm" },
  { words: ["كيلومتر", "كلم", "كم"], symbol: "km" },
  { words: ["متر", "أمتار"], symbol: "m" },
  { words: ["طن", "أطنان"], symbol: "t" },
];

/** رقم عربي أو لاتيني، ويقبل الفواصل والكسور: 622 · 3,461 · 271.5 */
const NUMBER = "([\\d\\u0660-\\u0669][\\d\\u0660-\\u0669.,]*)";

function build(suffixWords: string[]): RegExp {
  return new RegExp(`${NUMBER}\\s*(?:${suffixWords.join("|")})(?![\\u0621-\\u064A])`, "u");
}

/** يقصّ الفواصل الزائدة في نهاية الرقم: «622،» → «622» */
function tidy(value: string): string {
  return toLatinDigits(value.replace(/[.,،]+$/u, ""));
}

/**
 * يستخرج الرقم البارز من عنوان المادة، أو null حين لا يوجد رقم واضح.
 * الترتيب مقصود: النسبة أولًا لأنها أوضح ما يحمله العنوان، ثم المقاييس.
 */
export function headlineStat(title: string): string | null {
  const percent = new RegExp(`${NUMBER}\\s*[%\\u066A]`, "u").exec(title);
  if (percent) return `${tidy(percent[1])}%`;

  for (const { words, symbol } of SCALES) {
    const match = build(words).exec(title);
    if (match) return `${tidy(match[1])}${symbol}`;
  }

  for (const { words, symbol } of UNITS) {
    const match = build(words).exec(title);
    if (match) return `${tidy(match[1])}${symbol}`;
  }

  return null;
}
