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

const HIJRI = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const GREGORIAN = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** «هجري ثم ميلادي» بأسماء أشهر عربية وأرقام لاتينية. */
export function brandDate(iso: string): { hijri: string; gregorian: string } {
  const date = new Date(iso);
  return {
    hijri: toLatinDigits(HIJRI.format(date)),
    gregorian: toLatinDigits(GREGORIAN.format(date)),
  };
}

/** موجز المادة للعرض: يُنظَّف من حشو ووردبريس ويُقصّ إلى جملة مقروءة. */
export function formatArticleDek(excerpt: string, maxChars = 168): string {
  const text = excerpt.replace(/\s+/g, " ").replace(/[.\s…]+$/u, "").trim();
  if (!text) return "";
  if (text.length <= maxChars) return /[.؟!]$/.test(text) ? text : `${text}.`;
  const slice = text.slice(0, maxChars);
  const at = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("،"), slice.lastIndexOf(" "));
  const cut = (at > 72 ? slice.slice(0, at) : slice).trim();
  return `${cut.replace(/[،,;:]$/u, "")}…`;
}
